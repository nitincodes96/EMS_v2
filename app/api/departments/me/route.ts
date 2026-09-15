import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { countActiveFacultyBookings } from "@/lib/booking-rules"
import { getScheduleSettings } from "@/lib/schedule-settings"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "No department associated with this account" }, { status: 404 })
  }

  // Holidays and attendance locations are organization-wide now, but they're
  // still surfaced here under the department so every dashboard keeps reading
  // them from one place.
  const [department, schedule, holidays, locations] = await Promise.all([
    prisma.department.findUnique({ where: { id: sessionUser.departmentId } }),
    getScheduleSettings(),
    prisma.holiday.findMany({ orderBy: { date: "asc" } }),
    prisma.attendanceLocation.findMany({ orderBy: { createdAt: "asc" } }),
  ])

  if (!department) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }

  // Only meaningful for faculty booking PAs — the cap tracks their own open bookings.
  const activeBookingCount =
    sessionUser.role === "FACULTY" ? await countActiveFacultyBookings(sessionUser.id, department.id) : null

  return NextResponse.json({
    department: {
      id: department.id,
      name: department.name,
      description: department.description,
      logoUrl: department.logoUrl,
      // Schedule values are organization-wide but surfaced here under the
      // same keys so every dashboard keeps reading them from one place.
      shiftStartTime: schedule.shiftStartTime,
      shiftEndTime: schedule.shiftEndTime,
      workingDays: schedule.workingDays,
      geofenceEnabled: schedule.geofenceEnabled,
      facultyBookingLimit: schedule.facultyBookingLimit,
      facultyActiveBookingCount: activeBookingCount,
      holidays: holidays.map((holiday) => ({
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        type: holiday.type,
      })),
      locations: locations.map((l) => ({
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
    },
  })
}
