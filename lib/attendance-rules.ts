import prisma from "@/lib/prisma"
import { haversineDistanceMeters } from "@/lib/geo"

/**
 * Geofence guard for a check-in/check-out. Location is only required (and only
 * enforced against the department's pinned locations) when the department has
 * geofencing switched on — previously this flag was never read and location
 * was demanded unconditionally, even for departments that don't use it.
 * Returns an error + status when the punch should be rejected, or null to proceed.
 */
export async function checkGeofence({
  departmentId,
  latitude,
  longitude,
}: {
  departmentId: string
  latitude: number | null
  longitude: number | null
}): Promise<{ error: string; status: number } | null> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { geofenceEnabled: true },
  })
  if (!department?.geofenceEnabled) return null

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { error: "This department requires your location to punch attendance", status: 400 }
  }

  const locations = await prisma.departmentLocation.findMany({ where: { departmentId } })
  if (locations.length === 0) return null

  const withinAny = locations.some(
    (loc) => haversineDistanceMeters(latitude, longitude, loc.latitude, loc.longitude) <= loc.radiusMeters
  )
  if (!withinAny) {
    return { error: "You are outside all configured locations for this department", status: 400 }
  }

  return null
}
