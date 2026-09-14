import { NextResponse } from "next/server"
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from "date-fns"
import prisma from "@/lib/prisma"
import { getScheduleSettings, lateAfterMinutes } from "@/lib/schedule-settings"
import { getSessionUser } from "@/lib/api-auth"

// GET: figures for the Admin dashboard.
// Bookings lead the series because slot coverage matters more than raw punches.
// Query: ?departmentId= narrows every department-scoped figure; the department
// count itself stays organization-wide.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")
  const departmentId = departmentIdParam && departmentIdParam !== "all" ? departmentIdParam : null
  const scope = departmentId ? { departmentId } : {}

  const now = new Date()
  const todayStart = startOfDay(now)
  const windowStart = startOfDay(subDays(now, 6)) // 7-day window, inclusive
  const windowEnd = endOfDay(now)

  const [
    departmentCount,
    users,
    departments,
    todayAttendanceCount,
    activeBookings,
    weekBookings,
    weekAttendance,
    recentBookings,
  ] = await Promise.all([
    prisma.department.count(),
    prisma.user.findMany({
      where: { role: { not: "ADMIN" }, ...scope },
      select: { id: true, role: true, isActive: true, departmentId: true },
    }),
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.count({ where: { checkInTime: { gte: todayStart, lte: windowEnd }, ...scope } }),
    prisma.booking.count({ where: { status: "BOOKED", endTime: { gte: now }, ...scope } }),
    prisma.booking.findMany({
      where: { date: { gte: windowStart, lte: windowEnd }, ...scope },
      select: { date: true, status: true },
    }),
    prisma.attendance.findMany({
      where: { checkInTime: { gte: windowStart, lte: windowEnd }, ...scope },
      select: { checkInTime: true, departmentId: true },
    }),
    prisma.booking.findMany({
      take: 6,
      where: scope,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        workType: true,
        status: true,
        faculty: { select: { name: true } },
        pa: { select: { name: true } },
        department: { select: { name: true } },
      },
    }),
  ])

  // One late threshold for everyone — shift start and grace are organization-wide
  const lateAfterAll = lateAfterMinutes(await getScheduleSettings())
  const lateAfter = new Map(departments.map((d) => [d.id, lateAfterAll]))

  const activeStaff = users.filter((u) => u.isActive && u.departmentId)
  const paCount = activeStaff.filter((u) => u.role === "PROJECT_ASSISTANT").length
  const facultyCount = activeStaff.filter((u) => u.role === "FACULTY").length
  // Attendance is punched by Project Assistants only — Faculty never check in,
  // so counting them as "expected" would permanently understate the rate.
  const expectedToPunch = paCount

  const days = eachDayOfInterval({ start: windowStart, end: todayStart })

  const bookingSeries = days.map((day) => {
    const key = format(day, "yyyy-MM-dd")
    const forDay = weekBookings.filter((b) => format(b.date, "yyyy-MM-dd") === key)
    return {
      day: format(day, "EEE"),
      booked: forDay.filter((b) => b.status === "BOOKED").length,
      completed: forDay.filter((b) => b.status === "COMPLETED").length,
      incomplete: forDay.filter((b) => b.status === "INCOMPLETE").length,
      absent: forDay.filter((b) => b.status === "ABSENT").length,
    }
  })

  const attendanceSeries = days.map((day) => {
    const key = format(day, "yyyy-MM-dd")
    const forDay = weekAttendance.filter((a) => format(a.checkInTime, "yyyy-MM-dd") === key)
    let onTime = 0
    let late = 0
    for (const record of forDay) {
      const minutes = record.checkInTime.getHours() * 60 + record.checkInTime.getMinutes()
      const threshold = lateAfter.get(record.departmentId) ?? 9 * 60
      if (minutes > threshold) late += 1
      else onTime += 1
    }
    return {
      day: format(day, "EEE"),
      onTime,
      late,
      // PAs expected in that day who never punched
      absent: Math.max(0, expectedToPunch - forDay.length),
    }
  })

  return NextResponse.json({
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    stats: {
      departments: departmentCount,
      totalUsers: users.length,
      paCount,
      facultyCount,
      activeBookings,
      todayPresent: todayAttendanceCount,
      todayExpected: expectedToPunch,
      todayAttendanceRate:
        expectedToPunch > 0 ? Math.round((todayAttendanceCount / expectedToPunch) * 1000) / 10 : 0,
    },
    bookingSeries,
    attendanceSeries,
    recentBookings: recentBookings.map((b) => ({
      id: b.id,
      date: format(b.date, "yyyy-MM-dd"),
      slot: `${format(b.startTime, "h:mm a")} – ${format(b.endTime, "h:mm a")}`,
      workType: b.workType,
      status: b.status,
      facultyName: b.faculty.name,
      paName: b.pa.name,
      departmentName: b.department.name,
    })),
  })
}
