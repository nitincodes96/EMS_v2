import { NextResponse } from "next/server"
import { startOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"

// GET: role-scoped booking list
//  - FACULTY: bookings they created
//  - PROJECT_ASSISTANT: bookings assigned to them
//  - ADMIN: all bookings (optionally filtered by ?departmentId=)
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")

  const where =
    sessionUser.role === "FACULTY"
      ? { facultyId: sessionUser.id }
      : sessionUser.role === "PROJECT_ASSISTANT"
        ? { paId: sessionUser.id }
        : departmentIdParam && departmentIdParam !== "all"
          ? { departmentId: departmentIdParam }
          : {}

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      faculty: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
      pa: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  })

  return NextResponse.json({ bookings })
}

// POST: Faculty (or Admin) books a PA for a slot with a task (FR-4.4/4.5)
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { paId, date, startTime, endTime, task } = body as {
      paId: string
      date: string
      startTime: string
      endTime: string
      task: string
    }

    if (!paId || !date || !startTime || !endTime || !task?.trim()) {
      return NextResponse.json({ error: "PA, date, time slot and task are required" }, { status: 400 })
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

    const bookingDate = startOfDay(new Date(date))
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: "Invalid time slot" }, { status: 400 })
    }

    // Block booking if PA has approved leave on that date (FR-6.7)
    const onLeave = await prisma.leave.findFirst({
      where: {
        userId: paId,
        status: "APPROVED",
        startDate: { lte: bookingDate },
        endDate: { gte: bookingDate },
      },
    })
    if (onLeave) {
      return NextResponse.json({ error: "PA is on approved leave for that date" }, { status: 409 })
    }

    // Prevent overlapping bookings for the same PA
    const overlap = await prisma.booking.findFirst({
      where: {
        paId,
        date: bookingDate,
        status: { in: ["BOOKED", "COMPLETED"] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
    })
    if (overlap) {
      return NextResponse.json({ error: "PA already has a booking overlapping this slot" }, { status: 409 })
    }

    const booking = await prisma.booking.create({
      data: {
        departmentId: pa.departmentId,
        facultyId: sessionUser.id,
        paId,
        date: bookingDate,
        startTime: start,
        endTime: end,
        task: task.trim(),
        status: "BOOKED",
      },
      include: {
        faculty: { select: { id: true, name: true, username: true } },
        pa: { select: { id: true, name: true, username: true } },
      },
    })

    // Notify the PA (FR-4.5 / FR-5.4)
    const slotLabel = `${startTime}–${endTime}`
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
