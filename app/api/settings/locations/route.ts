import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { logEvent } from "@/lib/system-log"

type LocationInput = { name?: unknown; latitude?: unknown; longitude?: unknown; radiusMeters?: unknown }

// GET: the organization-wide attendance locations. Any signed-in user — the
// punch-in screen and the department info popover both show them.
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const locations = await prisma.attendanceLocation.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json({ locations })
}

// PUT { locations: [...] }: admin replaces the whole list. Same shape the old
// per-department editor used — a full list is easier to reason about than
// per-pin add/remove when pins get reordered or edited in place.
export async function PUT(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { locations?: LocationInput[] }
    if (!Array.isArray(body.locations)) {
      return NextResponse.json({ error: "locations must be an array" }, { status: 400 })
    }

    const clean: { name: string; latitude: number; longitude: number; radiusMeters: number }[] = []
    for (const raw of body.locations) {
      const name = typeof raw.name === "string" ? raw.name.trim() : ""
      const latitude = Number(raw.latitude)
      const longitude = Number(raw.longitude)
      const radiusMeters = Math.round(Number(raw.radiusMeters ?? 100)) || 100
      if (!name) return NextResponse.json({ error: "Every location needs a name" }, { status: 400 })
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return NextResponse.json({ error: `"${name}": latitude must be between -90 and 90` }, { status: 400 })
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return NextResponse.json({ error: `"${name}": longitude must be between -180 and 180` }, { status: 400 })
      }
      if (radiusMeters < 10 || radiusMeters > 10000) {
        return NextResponse.json({ error: `"${name}": radius must be between 10 and 10000 metres` }, { status: 400 })
      }
      clean.push({ name, latitude, longitude, radiusMeters })
    }

    const before = await prisma.attendanceLocation.count()
    await prisma.$transaction(async (tx) => {
      await tx.attendanceLocation.deleteMany({})
      if (clean.length > 0) await tx.attendanceLocation.createMany({ data: clean })
    })
    const locations = await prisma.attendanceLocation.findMany({ orderBy: { createdAt: "asc" } })

    await logEvent({
      category: "DEPARTMENT",
      action: "Attendance locations updated",
      description: `Attendance locations set to ${clean.length} pin${clean.length === 1 ? "" : "s"} (was ${before})${
        clean.length > 0 ? `: ${clean.map((l) => l.name).join(", ")}` : ""
      }`,
      actor: sessionUser,
      entityType: "AttendanceLocation",
    })

    return NextResponse.json({ locations })
  } catch (error) {
    console.error("Error saving attendance locations:", error)
    return NextResponse.json({ error: "Failed to save locations" }, { status: 500 })
  }
}
