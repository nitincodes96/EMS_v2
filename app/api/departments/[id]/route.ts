import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"

type LocationInput = { name: string; latitude: number; longitude: number; radiusMeters: number }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null
    const workingDays = (formData.get("workingDays") as string) || existing.workingDays
    const shiftStartTime = (formData.get("shiftStartTime") as string) || existing.shiftStartTime
    const shiftEndTime = (formData.get("shiftEndTime") as string) || existing.shiftEndTime
    const lateGraceMinutes = parseInt((formData.get("lateGraceMinutes") as string) || String(existing.lateGraceMinutes), 10)
    const facultyBookingLimitRaw = formData.get("facultyBookingLimit") as string | null
    const facultyBookingLimit =
      facultyBookingLimitRaw != null && facultyBookingLimitRaw !== ""
        ? parseInt(facultyBookingLimitRaw, 10)
        : existing.facultyBookingLimit
    if (isNaN(facultyBookingLimit) || facultyBookingLimit < 0) {
      return NextResponse.json({ error: "Booking limit must be a non-negative number" }, { status: 400 })
    }
    const geofenceEnabledRaw = formData.get("geofenceEnabled") as string | null
    const geofenceEnabled = geofenceEnabledRaw != null ? geofenceEnabledRaw === "true" : existing.geofenceEnabled

    const slotDurationRaw = formData.get("slotDurationMinutes") as string | null
    const slotDurationMinutes =
      slotDurationRaw != null && slotDurationRaw !== ""
        ? parseInt(slotDurationRaw, 10)
        : existing.slotDurationMinutes
    if (isNaN(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 480) {
      return NextResponse.json({ error: "Slot duration must be between 5 and 480 minutes" }, { status: 400 })
    }

    const bookingHorizonRaw = formData.get("bookingHorizonDays") as string | null
    const bookingHorizonDays =
      bookingHorizonRaw != null && bookingHorizonRaw !== ""
        ? parseInt(bookingHorizonRaw, 10)
        : existing.bookingHorizonDays
    if (isNaN(bookingHorizonDays) || bookingHorizonDays < 1 || bookingHorizonDays > 90) {
      return NextResponse.json({ error: "Booking window must be between 1 and 90 days" }, { status: 400 })
    }

    const bookingChangeCutoffRaw = formData.get("bookingChangeCutoffMinutes") as string | null
    const bookingChangeCutoffMinutes =
      bookingChangeCutoffRaw != null && bookingChangeCutoffRaw !== ""
        ? parseInt(bookingChangeCutoffRaw, 10)
        : existing.bookingChangeCutoffMinutes
    if (isNaN(bookingChangeCutoffMinutes) || bookingChangeCutoffMinutes < 0 || bookingChangeCutoffMinutes > 2880) {
      return NextResponse.json(
        { error: "Change cutoff must be between 0 and 2880 minutes (48 hours)" },
        { status: 400 }
      )
    }

    // Optional lunch break — both times or neither (empty clears it)
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

    let locations: LocationInput[] | null = null
    const locationsRaw = formData.get("locations") as string | null
    if (locationsRaw) {
      try {
        locations = JSON.parse(locationsRaw)
      } catch {
        return NextResponse.json({ error: "Invalid locations payload" }, { status: 400 })
      }
    }

    let logoUrl: string | undefined
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "departments")
    }

    await prisma.$transaction(async (tx) => {
      await tx.department.update({
        where: { id },
        data: {
          name,
          description,
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
          ...(logoUrl ? { logoUrl } : {}),
        },
      })

      if (locations) {
        await tx.departmentLocation.deleteMany({ where: { departmentId: id } })
        if (locations.length > 0) {
          await tx.departmentLocation.createMany({
            data: locations.map((l) => ({
              departmentId: id,
              name: l.name,
              latitude: Number(l.latitude),
              longitude: Number(l.longitude),
              radiusMeters: Number(l.radiusMeters) || 100,
            })),
          })
        }
      }
    })

    const department = await prisma.department.findUnique({
      where: { id },
      include: { locations: true },
    })

    return NextResponse.json({ department })
  } catch (error) {
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}
