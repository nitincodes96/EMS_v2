import { NextResponse } from "next/server"
import { startOfMonth, endOfMonth, format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: the signed-in user's attendance records for a month, for calendar views.
// Query: ?month=YYYY-MM (defaults to the current month)
//
// Days are derived from checkInTime (a true instant) rather than the
// Attendance.date @db.Date column, so the calendar day is always the local day
// the user actually punched in on.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get("month")

  const match = monthParam ? /^(\d{4})-(\d{2})$/.exec(monthParam) : null
  if (monthParam && !match) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 })
  }

  const anchor = match
    ? new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, 1)
    : new Date()
  const from = startOfMonth(anchor)
  const to = endOfMonth(anchor)
  to.setHours(23, 59, 59, 999)

  const [records, department] = await Promise.all([
    prisma.attendance.findMany({
      where: { userId: sessionUser.id, checkInTime: { gte: from, lte: to } },
      orderBy: { checkInTime: "asc" },
      select: {
        id: true,
        checkInTime: true,
        checkOutTime: true,
        flaggedOutsideGeofence: true,
      },
    }),
    prisma.department.findUnique({
      where: { id: sessionUser.departmentId },
      select: { shiftStartTime: true, lateGraceMinutes: true },
    }),
  ])

  // A punch counts as late once it passes shift start + the grace window
  const [shiftH, shiftM] = (department?.shiftStartTime ?? "09:00").split(":").map(Number)
  const lateAfterMinutes = shiftH * 60 + shiftM + (department?.lateGraceMinutes ?? 0)

  return NextResponse.json({
    records: records.map((r) => {
      const minutesIn = r.checkInTime.getHours() * 60 + r.checkInTime.getMinutes()
      return {
        id: r.id,
        date: format(r.checkInTime, "yyyy-MM-dd"),
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        status: minutesIn > lateAfterMinutes ? "LATE" : "PRESENT",
        flaggedOutsideGeofence: r.flaggedOutsideGeofence,
      }
    }),
  })
}
