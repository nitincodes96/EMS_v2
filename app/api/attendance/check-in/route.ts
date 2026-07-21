import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { startOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { haversineDistanceMeters } from "@/lib/geo"

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { latitude, longitude } = body as { latitude: number; longitude: number }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "latitude and longitude are required" }, { status: 400 })
    }

    const locations = await prisma.departmentLocation.findMany({
      where: { departmentId: sessionUser.departmentId },
    })

    if (locations.length > 0) {
      const withinAny = locations.some(
        (loc) => haversineDistanceMeters(latitude, longitude, loc.latitude, loc.longitude) <= loc.radiusMeters
      )
      if (!withinAny) {
        return NextResponse.json({ error: "You are outside all configured check-in locations" }, { status: 400 })
      }
    }

    const now = new Date()
    const attendance = await prisma.attendance.create({
      data: {
        departmentId: sessionUser.departmentId,
        userId: sessionUser.id,
        date: startOfDay(now),
        checkInTime: now,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
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
