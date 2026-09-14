import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { logEvent } from "@/lib/system-log"

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
    const geofenceEnabledRaw = formData.get("geofenceEnabled") as string | null
    const geofenceEnabled = geofenceEnabledRaw != null ? geofenceEnabledRaw === "true" : existing.geofenceEnabled

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
          geofenceEnabled,
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

    await logEvent({
      category: "DEPARTMENT",
      action: "Department updated",
      description: describeDepartmentChanges(existing, { name, geofenceEnabled }),
      actor: sessionUser,
      entityType: "Department",
      entityId: id,
      departmentId: id,
    })

    return NextResponse.json({ department })
  } catch (error) {
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

/**
 * Names the settings that actually changed, so the audit trail reads
 * "Updated FSM: geo-fence on -> off" rather than just "updated". Falls back
 * to a plain notice when only untracked fields (logo, description, locations)
 * moved.
 */
function describeDepartmentChanges(
  before: DepartmentSettings & { name: string },
  after: DepartmentSettings & { name: string }
): string {
  const changes: string[] = []
  if (before.name !== after.name) {
    changes.push(`renamed to "${after.name}"`)
  }
  if (before.geofenceEnabled !== after.geofenceEnabled) {
    changes.push(`geo-fence ${before.geofenceEnabled ? "on" : "off"} \u2192 ${after.geofenceEnabled ? "on" : "off"}`)
  }

  return changes.length > 0
    ? `Updated "${after.name}": ${changes.join(", ")}`
    : `Updated "${after.name}" settings`
}

type DepartmentSettings = {
  geofenceEnabled: boolean
}
