import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { checkGeofence } from "@/lib/attendance-rules"

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { latitude, longitude } = body as { latitude?: number; longitude?: number }
    const lat = typeof latitude === "number" ? latitude : null
    const lng = typeof longitude === "number" ? longitude : null

    const geofenceError = await checkGeofence({ latitude: lat, longitude: lng })
    if (geofenceError) {
      return NextResponse.json({ error: geofenceError.error }, { status: geofenceError.status })
    }

    const now = new Date()
    const todaysAttendance = await prisma.attendance.findFirst({
      where: {
        userId: sessionUser.id,
        date: { gte: startOfDay(now), lte: endOfDay(now) },
        checkOutTime: null,
      },
    })

    if (!todaysAttendance) {
      return NextResponse.json({ error: "No open check-in found for today" }, { status: 404 })
    }

    const attendance = await prisma.attendance.update({
      where: { id: todaysAttendance.id },
      data: {
        checkOutTime: now,
        checkOutLatitude: lat,
        checkOutLongitude: lng,
      },
    })

    // Checking out ends availability — the user is no longer bookable.
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { isAvailable: false, availabilitySince: null },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error("Error checking out:", error)
    return NextResponse.json({ error: "Failed to check out" }, { status: 500 })
  }
}
