import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { generateUniqueOrgSlug } from "@/lib/slug"
import { saveUploadedFile } from "@/lib/upload"
import { logEvent } from "@/lib/system-log"

type LocationInput = { name: string; latitude: number; longitude: number; radiusMeters: number }
type HolidayInput = { name: string; date: string; type: "CUSTOM" | "RELIGIOUS" | "NATIONAL" }

export async function GET() {
  const sessionUser = await getSessionUser()
  // Moderators work across the organization, so they may read the department list.
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const departments = await prisma.department.findMany({
    include: {
      locations: true,
      _count: { select: { users: true, leaves: true, attendances: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const adminCounts = await prisma.user.groupBy({
    by: ["departmentId", "role"],
    where: { departmentId: { in: departments.map((o) => o.id) }, role: { in: ["FACULTY", "PROJECT_ASSISTANT"] } },
    _count: { _all: true },
  })

  const result = departments.map((org) => {
    const adminCount = adminCounts.find((c) => c.departmentId === org.id && c.role === "FACULTY")?._count._all ?? 0
    const userCount = adminCounts.find((c) => c.departmentId === org.id && c.role === "PROJECT_ASSISTANT")?._count._all ?? 0
    return { ...org, adminCount, userCount }
  })

  return NextResponse.json({ departments: result })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null
    const workingDays = (formData.get("workingDays") as string) || "Mon,Tue,Wed,Thu,Fri"
    const shiftStartTime = (formData.get("shiftStartTime") as string) || "09:00"
    const shiftEndTime = (formData.get("shiftEndTime") as string) || "18:00"
    const lateGraceMinutes = parseInt((formData.get("lateGraceMinutes") as string) || "5", 10)
    const facultyBookingLimitRaw = formData.get("facultyBookingLimit") as string | null
    const facultyBookingLimit =
      facultyBookingLimitRaw != null && facultyBookingLimitRaw !== "" ? parseInt(facultyBookingLimitRaw, 10) : 3
    if (isNaN(facultyBookingLimit) || facultyBookingLimit < 0) {
      return NextResponse.json({ error: "Booking limit must be a non-negative number" }, { status: 400 })
    }
    // Geo-fencing is on unless explicitly switched off.
    const geofenceEnabledRaw = formData.get("geofenceEnabled") as string | null
    const geofenceEnabled = geofenceEnabledRaw != null ? geofenceEnabledRaw === "true" : true

    const slotDurationRaw = formData.get("slotDurationMinutes") as string | null
    const slotDurationMinutes =
      slotDurationRaw != null && slotDurationRaw !== "" ? parseInt(slotDurationRaw, 10) : 30
    if (isNaN(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 480) {
      return NextResponse.json({ error: "Slot duration must be between 5 and 480 minutes" }, { status: 400 })
    }

    const bookingHorizonRaw = formData.get("bookingHorizonDays") as string | null
    const bookingHorizonDays =
      bookingHorizonRaw != null && bookingHorizonRaw !== "" ? parseInt(bookingHorizonRaw, 10) : 7
    if (isNaN(bookingHorizonDays) || bookingHorizonDays < 1 || bookingHorizonDays > 90) {
      return NextResponse.json({ error: "Booking window must be between 1 and 90 days" }, { status: 400 })
    }

    const bookingChangeCutoffRaw = formData.get("bookingChangeCutoffMinutes") as string | null
    const bookingChangeCutoffMinutes =
      bookingChangeCutoffRaw != null && bookingChangeCutoffRaw !== "" ? parseInt(bookingChangeCutoffRaw, 10) : 60
    if (isNaN(bookingChangeCutoffMinutes) || bookingChangeCutoffMinutes < 0 || bookingChangeCutoffMinutes > 2880) {
      return NextResponse.json(
        { error: "Change cutoff must be between 0 and 2880 minutes (48 hours)" },
        { status: 400 }
      )
    }

    // Optional lunch break — both times or neither
    const lunchStartRaw = ((formData.get("lunchStartTime") as string) || "").trim()
    const lunchEndRaw = ((formData.get("lunchEndTime") as string) || "").trim()
    if (Boolean(lunchStartRaw) !== Boolean(lunchEndRaw)) {
      return NextResponse.json({ error: "Provide both lunch start and end, or leave both empty" }, { status: 400 })
    }
    if (lunchStartRaw && lunchEndRaw && lunchEndRaw <= lunchStartRaw) {
      return NextResponse.json({ error: "Lunch end time must be after the start time" }, { status: 400 })
    }
    const lunchStartTime = lunchStartRaw || null
    const lunchEndTime = lunchEndRaw || null

    let locations: LocationInput[] = []
    const locationsRaw = formData.get("locations") as string | null
    if (locationsRaw) {
      try {
        locations = JSON.parse(locationsRaw)
      } catch {
        return NextResponse.json({ error: "Invalid locations payload" }, { status: 400 })
      }
    }

    let holidays: HolidayInput[] = []
    const holidaysRaw = formData.get("holidays") as string | null
    if (holidaysRaw) {
      try {
        holidays = JSON.parse(holidaysRaw)
      } catch {
        return NextResponse.json({ error: "Invalid holidays payload" }, { status: 400 })
      }
    }

    const organization = await prisma.organization.findFirst()
    if (!organization) {
      return NextResponse.json({ error: "No organization is registered" }, { status: 400 })
    }

    const slug = await generateUniqueOrgSlug(name)

    let logoUrl: string | null = null
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "departments")
    }

    const department = await prisma.department.create({
      data: {
        name,
        slug,
        description,
        logoUrl,
        organizationId: organization.id,
        workingDays,
        shiftStartTime,
        shiftEndTime,
        lateGraceMinutes,
        facultyBookingLimit,
        slotDurationMinutes,
        bookingHorizonDays,
        bookingChangeCutoffMinutes,
        geofenceEnabled,
        lunchStartTime,
        lunchEndTime,
        locations: {
          createMany: {
            data: locations.map((l) => ({
              name: l.name,
              latitude: Number(l.latitude),
              longitude: Number(l.longitude),
              radiusMeters: Number(l.radiusMeters) || 100,
            })),
          },
        },
        holidays: {
          createMany: {
            data: holidays.map((h) => ({
              name: h.name,
              date: new Date(h.date),
              type: h.type,
            })),
          },
        },
      },
      include: { locations: true },
    })

    await logEvent({
      category: "DEPARTMENT",
      action: "Department created",
      description: `Created department "${department.name}" with a ${shiftStartTime}–${shiftEndTime} shift on ${workingDays}`,
      actor: sessionUser,
      entityType: "Department",
      entityId: department.id,
      departmentId: department.id,
    })

    return NextResponse.json({ department }, { status: 201 })
  } catch (error) {
    console.error("Error creating department:", error)
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 })
  }
}
