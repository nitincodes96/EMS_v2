import { NextResponse } from "next/server"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"

// Read a Prisma @db.Date value (stored as UTC midnight) back to a "yyyy-MM-dd"
// string without letting the server timezone shift the day.
function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60 * 1000

// GET: a single bookable PA plus the days in a month they're unavailable due
// to approved leave, so the calendar can mark them.
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

  const pa = await prisma.user.findUnique({
    where: { id: paId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      photoUrl: true,
      role: true,
      isActive: true,
      isAvailable: true,
      availabilitySince: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
  })

  if (!pa || pa.role !== "PROJECT_ASSISTANT" || !pa.isActive || !pa.departmentId) {
    return NextResponse.json({ error: "Project Assistant not found" }, { status: 404 })
  }

  // Faculty may only view PAs in their own department
  if (sessionUser.role === "FACULTY" && pa.departmentId !== sessionUser.departmentId) {
    return NextResponse.json({ error: "You can only book PAs in your department" }, { status: 403 })
  }

  // Approved leaves overlapping the requested month, expanded to individual days
  const [leaves, bookings, holidays] = await Promise.all([
    prisma.leave.findMany({
      where: {
        userId: paId,
        status: "APPROVED",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { startDate: true, endDate: true },
    }),
    prisma.booking.findMany({
      where: {
        paId,
        date: { gte: monthStart, lte: monthEnd },
        status: { in: ["BOOKED", "COMPLETED"] },
      },
      orderBy: { startTime: "asc" },
      select: { id: true, date: true, startTime: true, endTime: true, workType: true, task: true, status: true },
    }),
    prisma.holiday.findMany({
      where: {
        departmentId: pa.departmentId,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: "asc" },
      select: { id: true, name: true, date: true, type: true },
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

  return NextResponse.json({
    pa: {
      id: pa.id,
      name: pa.name,
      username: pa.username,
      email: pa.email,
      photoUrl: pa.photoUrl,
      isAvailable: pa.isAvailable,
      availabilitySince: pa.availabilitySince,
      department: pa.department,
    },
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    leaveDates: Array.from(leaveDateSet).sort(),
    bookings: bookings.map((b) => ({
      id: b.id,
      date: toDateKey(b.date),
      start: format(b.startTime, "HH:mm"),
      end: format(b.endTime, "HH:mm"),
      workType: b.workType,
      task: b.task,
      status: b.status,
    })),
    holidays: holidays.map((h) => ({
      id: h.id,
      date: toDateKey(h.date),
      name: h.name,
      type: h.type,
    })),
  })
}
