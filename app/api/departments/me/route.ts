import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { countActiveFacultyBookings } from "@/lib/booking-rules"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "No department associated with this account" }, { status: 404 })
  }

  const department = await prisma.department.findUnique({
    where: { id: sessionUser.departmentId },
    include: {
      locations: true,
      holidays: {
        orderBy: { date: "asc" },
      },
    },
  })

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
      shiftStartTime: department.shiftStartTime,
      shiftEndTime: department.shiftEndTime,
      workingDays: department.workingDays,
      geofenceEnabled: department.geofenceEnabled,
      facultyBookingLimit: department.facultyBookingLimit,
      facultyActiveBookingCount: activeBookingCount,
      holidays: department.holidays.map((holiday) => ({
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        type: holiday.type,
      })),
      locations: department.locations.map((l) => ({
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
    },
  })
}
