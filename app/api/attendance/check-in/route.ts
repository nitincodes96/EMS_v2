import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { startOfDay } from "date-fns"
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
    const attendance = await prisma.attendance.create({
      data: {
        departmentId: sessionUser.departmentId,
        userId: sessionUser.id,
        date: startOfDay(now),
        checkInTime: now,
        checkInLatitude: lat,
        checkInLongitude: lng,
      },
    })

    // Checking in also marks the user available/bookable (unified punch-in).
    // Project Assistants become visible to Faculty/Admin for booking.
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { isAvailable: true, availabilitySince: now },
    })

    return NextResponse.json({ attendance }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Already checked in today" }, { status: 409 })
    }
    console.error("Error checking in:", error)
    return NextResponse.json({ error: "Failed to check in" }, { status: 500 })
  }
}
