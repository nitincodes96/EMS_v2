import { NextResponse } from "next/server"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { getScheduleSettings, workingDaySet } from "@/lib/schedule-settings"
import { noticeWindow } from "@/lib/unavailability"

// Read a Prisma @db.Date value (stored as UTC midnight) back to a "yyyy-MM-dd"
// string without letting the server timezone shift the day.
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60 * 1000

// GET: a single bookable PA plus the days in a month they're unavailable due
// to approved leave or their own unavailability notices, so the calendar can
// mark them.
// Query: ?month=YYYY-MM (defaults to current month)
export async function GET(request: Request, { params }: { params: Promise<{ paId: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { paId } = await params
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get("month")

  const now = new Date()
  const monthMatch = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null
  const year = monthMatch ? parseInt(monthMatch[1], 10) : now.getUTCFullYear()
  const monthIndex = monthMatch ? parseInt(monthMatch[2], 10) - 1 : now.getUTCMonth()
  if (monthParam && (!monthMatch || monthIndex < 0 || monthIndex > 11)) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 })
  }
  // UTC month bounds so @db.Date comparisons don't drift with server timezone.
  const monthStart = new Date(Date.UTC(year, monthIndex, 1))
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999))

  const [pa, schedule] = await Promise.all([
    prisma.user.findUnique({
    where: { id: paId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      photoUrl: true,
      role: true,
      isActive: true,
      isAvailable: true,
      availabilitySince: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    }),
    getScheduleSettings(),
  ])

  if (!pa || pa.role !== "PROJECT_ASSISTANT" || !pa.isActive || !pa.departmentId) {
    return NextResponse.json({ error: "Project Assistant not found" }, { status: 404 })
  }

  // Faculty may only view PAs in their own department
  if (sessionUser.role === "FACULTY" && pa.departmentId !== sessionUser.departmentId) {
    return NextResponse.json({ error: "You can only book PAs in your department" }, { status: 403 })
  }

  // Approved leaves overlapping the requested month, expanded to individual days
  const [leaves, notices, bookings, holidays, ratingAgg] = await Promise.all([
    prisma.leave.findMany({
      where: {
        userId: paId,
        status: "APPROVED",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { startDate: true, endDate: true },
    }),
    // The PA's own "I won't be in" notices for the month
    prisma.unavailabilityNotice.findMany({
      where: { userId: paId, status: "ACTIVE", date: { gte: monthStart, lte: monthEnd } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { id: true, date: true, startTime: true, endTime: true, reason: true },
    }),
    prisma.booking.findMany({
      where: {
        paId,
        date: { gte: monthStart, lte: monthEnd },
        status: { in: ["BOOKED", "COMPLETED", "INCOMPLETE"] },
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        workType: true,
        task: true,
        status: true,
        facultyId: true,
        faculty: { select: { name: true } },
      },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true, type: true },
    }),
    // Lifetime rating average across every rated booking for this PA
    prisma.booking.aggregate({
      where: { paId, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])

  // Expand each approved leave into individual day keys, stepping in UTC so the
  // marked days match the calendar cells exactly.
  const leaveDateSet = new Set<string>()
  for (const leave of leaves) {
    const fromMs = Math.max(leave.startDate.getTime(), monthStart.getTime())
    const toMs = Math.min(leave.endDate.getTime(), monthEnd.getTime())
    for (let ms = fromMs; ms <= toMs; ms += DAY_MS) {
      leaveDateSet.add(toDateKey(new Date(ms)))
    }
  }

  // Whole-day notices block the day like leave; partial ones are listed so the
  // calendar can chip them and the slot picker can grey out the window.
  const unavailableDateSet = new Set<string>()
  const partialUnavailability: { id: string; date: string; start: string; end: string; reason: string | null }[] = []
  for (const n of notices) {
    const w = noticeWindow(n)
    const key = toDateKey(n.date)
    if (w.wholeDay) unavailableDateSet.add(key)
    else partialUnavailability.push({ id: n.id, date: key, start: w.start!, end: w.end!, reason: w.reason })
  }

  return NextResponse.json({
    pa: {
      id: pa.id,
      name: pa.name,
      email: pa.email,
      phoneNumber: pa.phoneNumber,
      photoUrl: pa.photoUrl,
      isAvailable: pa.isAvailable,
      availabilitySince: pa.availabilitySince,
      department: pa.department,
      rating: {
        average: ratingAgg._avg.rating ?? null,
        count: ratingAgg._count.rating,
      },
    },
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    // Organization working days as weekday abbreviations, e.g. ["Mon","Tue",...].
    // Non-working days aren't bookable.
    workingDays: Array.from(workingDaySet(schedule.workingDays)),
    // How many days ahead a booking may be made.
    bookingHorizonDays: schedule.bookingHorizonDays,
    leaveDates: Array.from(leaveDateSet).sort(),
    // Days the PA has flagged as fully unavailable, and part-day windows.
    unavailableDates: Array.from(unavailableDateSet).sort(),
    partialUnavailability,
    bookings: bookings.map((b) => ({
      id: b.id,
      date: toDateKey(b.date),
      start: format(b.startTime, "HH:mm"),
      end: format(b.endTime, "HH:mm"),
      workType: b.workType,
      task: b.task,
      status: b.status,
      bookedBy: b.faculty.name,
      // Only the owning faculty (or an admin) can open the booking's detail page
      canViewDetails: sessionUser.role === "ADMIN" || b.facultyId === sessionUser.id,
    })),
    holidays: holidays.map((h) => ({
      id: h.id,
      date: toDateKey(h.date),
      name: h.name,
      type: h.type,
    })),
  })
}
