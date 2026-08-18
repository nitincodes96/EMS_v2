import { NextResponse } from "next/server"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { countActiveFacultyBookings } from "@/lib/booking-rules"

// GET: per-PA, per-day booking availability so the calendar can render slots.
// Query: ?paId=<id>&date=YYYY-MM-DD
// Returns the department booking window, whether the whole day is blocked
// (approved leave), and the PA's existing bookings for that day.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const paId = searchParams.get("paId")
  const date = searchParams.get("date")
  // When rescheduling, the booking being moved shouldn't block its own slots.
  const excludeBookingId = searchParams.get("excludeBookingId")

  if (!paId || !date) {
    return NextResponse.json({ error: "paId and date are required" }, { status: 400 })
  }

  // UTC midnight to match how bookings/leaves store their @db.Date values.
  const bookingDate = new Date(`${date}T00:00:00.000Z`)
  if (isNaN(bookingDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  const pa = await prisma.user.findUnique({
    where: { id: paId },
    include: { department: true },
  })
  if (!pa || pa.role !== "PROJECT_ASSISTANT" || !pa.departmentId || !pa.department) {
    return NextResponse.json({ error: "Selected user is not a bookable Project Assistant" }, { status: 400 })
  }

  // Faculty may only inspect PAs in their own department
  if (sessionUser.role === "FACULTY" && pa.departmentId !== sessionUser.departmentId) {
    return NextResponse.json({ error: "You can only book PAs in your department" }, { status: 403 })
  }

  // Whole-day block: approved leave covering the date (FR-6.7)
  const onLeave = await prisma.leave.findFirst({
    where: {
      userId: paId,
      status: "APPROVED",
      startDate: { lte: bookingDate },
      endDate: { gte: bookingDate },
    },
  })

  // Existing bookings that consume slots on that day
  const bookings = await prisma.booking.findMany({
    where: {
      paId,
      date: bookingDate,
      status: { in: ["BOOKED", "COMPLETED"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    orderBy: { startTime: "asc" },
    select: { id: true, startTime: true, endTime: true, status: true },
  })

  // The requesting faculty's own booking limit in this department (FR: PA
  // booking limit). Rescheduling doesn't add a new active booking, so the
  // booking being moved is excluded from the count.
  const limit = pa.department.facultyBookingLimit
  const activeCount = excludeBookingId
    ? await prisma.booking.count({
        where: { facultyId: sessionUser.id, departmentId: pa.departmentId, status: "BOOKED", id: { not: excludeBookingId } },
      })
    : await countActiveFacultyBookings(sessionUser.id, pa.departmentId)

  return NextResponse.json({
    bookingLimit: {
      limit,
      active: activeCount,
      reached: limit > 0 && activeCount >= limit,
    },
    // Slots follow the department's configured working hours (shift times), the
    // only window an admin actually edits. bookingEnabled still gates booking.
    bookingWindow: {
      start: pa.department.shiftStartTime,
      end: pa.department.shiftEndTime,
      enabled: pa.department.bookingEnabled,
    },
    // Length of one slot in the grid, set per department.
    slotDurationMinutes: pa.department.slotDurationMinutes,
    // Optional lunch break — the client drops slots overlapping this window
    lunch: {
      start: pa.department.lunchStartTime,
      end: pa.department.lunchEndTime,
    },
    dayUnavailable: Boolean(onLeave),
    dayUnavailableReason: onLeave ? "PA is on approved leave this day" : null,
    booked: bookings.map((b) => ({
      id: b.id,
      start: format(b.startTime, "HH:mm"),
      end: format(b.endTime, "HH:mm"),
      status: b.status,
    })),
  })
}
