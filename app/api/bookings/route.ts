import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"
import { isValidWorkType } from "@/lib/work-types"
import { checkSlotAvailability, toBookingDate } from "@/lib/booking-rules"

const LIST_INCLUDE = {
  faculty: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
  pa: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
  department: { select: { id: true, name: true } },
} as const

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

/**
 * Status buckets used by the list UIs. "IN_PROGRESS" covers both a slot that is
 * running now and one that has ended but has no recorded outcome yet.
 */
function bucketWhere(bucket: string | null, now: Date): Prisma.BookingWhereInput {
  switch (bucket) {
    case "UPCOMING":
      return { status: "BOOKED", startTime: { gt: now } }
    case "IN_PROGRESS":
      return { status: "BOOKED", startTime: { lte: now } }
    case "COMPLETED":
      return { status: "COMPLETED" }
    case "CLOSED":
      return { status: { in: ["ABSENT", "CANCELLED"] } }
    default:
      return {}
  }
}

// GET: role-scoped booking list
//  - FACULTY: bookings they created
//  - PROJECT_ASSISTANT: bookings assigned to them
//  - ADMIN: all bookings (optionally filtered by ?departmentId=)
//
// Pagination is opt-in: pass ?page= or ?limit= to get a page plus counts.
// Without them the full list is returned, which calendar/dashboard views rely on.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")
  const bucket = searchParams.get("bucket")
  const pageParam = searchParams.get("page")
  const limitParam = searchParams.get("limit")

  const scopeWhere: Prisma.BookingWhereInput =
    sessionUser.role === "FACULTY"
      ? { facultyId: sessionUser.id }
      : sessionUser.role === "PROJECT_ASSISTANT"
        ? { paId: sessionUser.id }
        : departmentIdParam && departmentIdParam !== "all"
          ? { departmentId: departmentIdParam }
          : {}

  const now = new Date()
  const where: Prisma.BookingWhereInput = { ...scopeWhere, ...bucketWhere(bucket, now) }

  // Soonest-first makes sense for upcoming work; everything else reads newest-first
  const orderBy: Prisma.BookingOrderByWithRelationInput[] =
    bucket === "UPCOMING"
      ? [{ date: "asc" }, { startTime: "asc" }]
      : [{ date: "desc" }, { startTime: "desc" }]

  // Legacy/full-list mode
  if (pageParam === null && limitParam === null) {
    const bookings = await prisma.booking.findMany({ where, include: LIST_INCLUDE, orderBy })
    return NextResponse.json({ bookings })
  }

  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(limitParam ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const requestedPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)

  const total = await prisma.booking.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / limit))
  // Clamp so deleting rows can't strand the client on an empty page
  const page = Math.min(requestedPage, totalPages)

  const [bookings, upcoming, inProgress, completed] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    // Stats span every bucket, so they use the scope filter only
    prisma.booking.count({ where: { ...scopeWhere, status: "BOOKED", startTime: { gt: now } } }),
    prisma.booking.count({ where: { ...scopeWhere, status: "BOOKED", startTime: { lte: now } } }),
    prisma.booking.count({ where: { ...scopeWhere, status: "COMPLETED" } }),
  ])

  return NextResponse.json({
    bookings,
    pagination: { page, limit, total, totalPages },
    stats: { upcoming, inProgress, completed },
  })
}

// POST: Faculty (or Admin) books a PA for a slot with a task (FR-4.4/4.5)
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { paId, date, startTime, endTime, task, workType } = body as {
      paId: string
      date: string
      startTime: string
      endTime: string
      task: string
      workType?: string
    }

    if (!paId || !date || !startTime || !endTime || !task?.trim()) {
      return NextResponse.json({ error: "PA, date, time slot and task are required" }, { status: 400 })
    }

    if (workType != null && !isValidWorkType(workType)) {
      return NextResponse.json({ error: "Invalid work type" }, { status: 400 })
    }

    const pa = await prisma.user.findUnique({ where: { id: paId } })
    if (!pa || pa.role !== "PROJECT_ASSISTANT") {
      return NextResponse.json({ error: "Selected user is not a Project Assistant" }, { status: 400 })
    }

    // Faculty may only book PAs in their own department
    if (sessionUser.role === "FACULTY" && pa.departmentId !== sessionUser.departmentId) {
      return NextResponse.json({ error: "You can only book PAs in your department" }, { status: 403 })
    }
    if (!pa.departmentId) {
      return NextResponse.json({ error: "PA has no department" }, { status: 400 })
    }

    // Store the calendar date as UTC midnight so the @db.Date column keeps the
    // exact day the faculty picked, regardless of server timezone (matches how
    // leaves store their dates). startOfDay() would localize and shift the day.
    const bookingDate = toBookingDate(date)
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    const unavailable = await checkSlotAvailability({ paId, bookingDate, start, end })
    if (unavailable) {
      return NextResponse.json({ error: unavailable.error }, { status: unavailable.status })
    }

    const booking = await prisma.booking.create({
      data: {
        departmentId: pa.departmentId,
        facultyId: sessionUser.id,
        paId,
        date: bookingDate,
        startTime: start,
        endTime: end,
        workType: workType ?? null,
        task: task.trim(),
        status: "BOOKED",
      },
      include: {
        faculty: { select: { id: true, name: true, username: true } },
        pa: { select: { id: true, name: true, username: true } },
      },
    })

    const slotLabel = `${startTime}–${endTime}`

    await prisma.bookingLog.create({
      data: {
        bookingId: booking.id,
        action: "CREATED",
        actorId: sessionUser.id,
        message: `Booked ${slotLabel} on ${date}${workType ? ` · ${workType}` : ""}`,
      },
    })

    // Notify the PA (FR-4.5 / FR-5.4)
    await createNotification({
      userId: paId,
      type: "BOOKING",
      title: "New task assigned",
      message: `${booking.faculty.name || booking.faculty.username} booked you for ${slotLabel} on ${date}: ${task.trim()}`,
      refId: booking.id,
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
  }
}
