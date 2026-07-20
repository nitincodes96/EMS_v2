import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"
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

    const locations = await prisma.departmentLocation.findMany({
      where: { departmentId: sessionUser.departmentId },
    })

    if (locations.length > 0) {
      const withinAny = locations.some(
        (loc) => haversineDistanceMeters(latitude, longitude, loc.latitude, loc.longitude) <= loc.radiusMeters
      )
      if (!withinAny) {
        return NextResponse.json({ error: "You are outside all configured check-out locations" }, { status: 400 })
      }
    }

    const attendance = await prisma.attendance.update({
      where: { id: todaysAttendance.id },
      data: {
        checkOutTime: now,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
      },
    })

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error("Error checking out:", error)
    return NextResponse.json({ error: "Failed to check out" }, { status: 500 })
  }
}
