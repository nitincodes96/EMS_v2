import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { isValidWorkType } from "@/lib/work-types"
import {
  checkBookingHorizon,
  checkSlotAvailability,
  checkSlotCount,
  countActiveFacultyBookings,
  toBookingDate,
} from "@/lib/booking-rules"
import { getScheduleSettings } from "@/lib/schedule-settings"
import { notifyPaOfBooking } from "@/lib/booking-notify"
import { logEvent } from "@/lib/system-log"

const LIST_INCLUDE = {
  faculty: { select: { id: true, name: true, email: true, photoUrl: true } },
  pa: { select: { id: true, name: true, email: true, photoUrl: true } },
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
      return { status: { in: ["ABSENT", "INCOMPLETE", "CANCELLED"] } }
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
  const sort = searchParams.get("sort")
  const pageParam = searchParams.get("page")
  const limitParam = searchParams.get("limit")
  const q = (searchParams.get("q") ?? "").trim()

  const scopeWhere: Prisma.BookingWhereInput =
    sessionUser.role === "FACULTY"
      ? { facultyId: sessionUser.id }
      : sessionUser.role === "PROJECT_ASSISTANT"
        ? { paId: sessionUser.id }
        : departmentIdParam && departmentIdParam !== "all"
          ? { departmentId: departmentIdParam }
          : {}

  // Free-text search across the work type, task, and the counterparty (faculty
  // for a PA, PA for a faculty) so either side can search by the other.
  const searchWhere: Prisma.BookingWhereInput = q
    ? {
        OR: [
          { workType: { contains: q } },
          { task: { contains: q } },
          { faculty: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } },
          { pa: { is: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } },
        ],
      }
    : {}

  const now = new Date()
  const where: Prisma.BookingWhereInput = { ...scopeWhere, ...bucketWhere(bucket, now), ...searchWhere }

  // Soonest-first makes sense for upcoming work. "createdAt" is an explicit
  // opt-in for history-style lists (e.g. faculty's My Bookings) where the most
  // recently made booking belongs at the top, regardless of which date it's
  // for — sorting by slot date there reads as random/backwards, since a
  // booking made just now for next week would otherwise outrank one made
  // yesterday for tomorrow. Everything else defaults to newest slot date first.
  const orderBy: Prisma.BookingOrderByWithRelationInput[] =
    bucket === "UPCOMING"
      ? [{ date: "asc" }, { startTime: "asc" }]
      : sort === "createdAt"
        ? [{ createdAt: "desc" }]
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
      task?: string
      workType?: string
    }

    if (!paId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: "PA, date and time slot are required" }, { status: 400 })
    }

    // Description is optional
    const taskText = task?.trim() || ""

    if (workType != null && !(await isValidWorkType(workType))) {
      return NextResponse.json({ error: "Invalid work type" }, { status: 400 })
    }

    const [pa, schedule] = await Promise.all([
      prisma.user.findUnique({
        where: { id: paId },
        include: { department: { select: { id: true } } },
      }),
      getScheduleSettings(),
    ])
    if (!pa || pa.role !== "PROJECT_ASSISTANT") {
      return NextResponse.json({ error: "Selected user is not a Project Assistant" }, { status: 400 })
    }
    if (!pa.isActive || pa.status !== "ACCEPTED") {
      return NextResponse.json(
        { error: "This PA hasn't activated their account yet and can't be booked" },
        { status: 400 }
      )
    }

    // Faculty may only book PAs in their own department
    if (sessionUser.role === "FACULTY" && pa.departmentId !== sessionUser.departmentId) {
      return NextResponse.json({ error: "You can only book PAs in your department" }, { status: 403 })
    }
    if (!pa.departmentId || !pa.department) {
      return NextResponse.json({ error: "PA has no department" }, { status: 400 })
    }

    if (!schedule.bookingEnabled) {
      return NextResponse.json({ error: "Booking is currently disabled" }, { status: 403 })
    }

    // Organization-wide cap on how many bookings a faculty can have open at
    // once (FR: PA booking limit). 0 = unlimited.
    const limit = schedule.facultyBookingLimit
    if (limit > 0) {
      const activeCount = await countActiveFacultyBookings(sessionUser.id, pa.departmentId)
      if (activeCount >= limit) {
        return NextResponse.json(
          {
            error: `You've reached your active booking limit (${limit}). Complete or cancel an existing booking before creating a new one.`,
          },
          { status: 409 }
        )
      }
    }

    // Store the calendar date as UTC midnight so the @db.Date column keeps the
    // exact day the faculty picked, regardless of server timezone (matches how
    // leaves store their dates). startOfDay() would localize and shift the day.
    const bookingDate = toBookingDate(date)
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    const horizonError = checkBookingHorizon(bookingDate, schedule.bookingHorizonDays)
    if (horizonError) {
      return NextResponse.json({ error: horizonError.error }, { status: horizonError.status })
    }

    const slotCountError = checkSlotCount(start, end, schedule.slotDurationMinutes, schedule.maxSlotsPerBooking)
    if (slotCountError) {
      return NextResponse.json({ error: slotCountError.error }, { status: slotCountError.status })
    }

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
        task: taskText,
        status: "BOOKED",
      },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        pa: { select: { id: true, name: true, email: true } },
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

    await logEvent({
      category: "BOOKING",
      action: "Booking created",
      description: `${booking.faculty.name || booking.faculty.email} booked ${booking.pa.name || booking.pa.email} for ${date} ${slotLabel}${workType ? ` · ${workType}` : ""}`,
      actor: sessionUser,
      entityType: "Booking",
      entityId: booking.id,
      departmentId: booking.departmentId,
    })

    // Notify the PA on the dashboard and by email (FR-4.5 / FR-5.4)
    await notifyPaOfBooking({
      bookingId: booking.id,
      event: "CREATED",
      pa: booking.pa,
      faculty: booking.faculty,
      departmentId: booking.departmentId,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      task: booking.task,
      workType: booking.workType,
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 })
  }
}
