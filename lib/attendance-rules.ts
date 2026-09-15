import prisma from "@/lib/prisma"
import { haversineDistanceMeters } from "@/lib/geo"
import { getScheduleSettings } from "@/lib/schedule-settings"

/**
 * Geofence guard for a check-in/check-out. Location is only required (and only
 * enforced against the organization's pinned attendance locations) when the
 * geo-fence is switched on in the global settings. Every department's staff
 * may punch from any of the pins.
 * Returns an error + status when the punch should be rejected, or null to proceed.
 */
export async function checkGeofence({
  latitude,
  longitude,
}: {
  latitude: number | null
  longitude: number | null
}): Promise<{ error: string; status: number } | null> {
  const settings = await getScheduleSettings()
  if (!settings.geofenceEnabled) return null

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { error: "Your location is required to punch attendance", status: 400 }
  }

  const locations = await prisma.attendanceLocation.findMany()
  if (locations.length === 0) return null

  const withinAny = locations.some(
    (loc) => haversineDistanceMeters(latitude, longitude, loc.latitude, loc.longitude) <= loc.radiusMeters
  )
  if (!withinAny) {
    return { error: "You are outside all configured attendance locations", status: 400 }
  }

  return null
}
