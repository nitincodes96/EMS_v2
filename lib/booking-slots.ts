// Shared time helpers for the PA booking calendar. Slot length is configured
// organization-wide (ScheduleSettings.slotDurationMinutes), so the grid is
// built from that rather than assuming whole hours.
//
// Pure module (no Prisma) so it can be imported from client components.

export type Slot = { startMin: number; endMin: number }

/** Fallback slot length before the schedule settings have loaded. */
export const DEFAULT_SLOT_MINUTES = 30

/** Slot lengths an admin can pick from in the schedule settings. */
export const SLOT_DURATION_OPTIONS = [15, 30, 60, 120] as const

/**
 * A booking may only be cancelled or rescheduled up to this many minutes
 * before its start time (ScheduleSettings.bookingChangeCutoffMinutes).
 * Fallback for before that setting has loaded.
 */
export const DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES = 60

/** "30 min" / "1 hr" / "1 hr 30 min" — used for labels and dropdowns. */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  const hourLabel = `${h} hr${h > 1 ? "s" : ""}`
  return m === 0 ? hourLabel : `${hourLabel} ${m} min`
}

/**
 * How far ahead a booking may be made (ScheduleSettings.bookingHorizonDays).
 * A slot can be booked from today up to and including
 * this many days from today. Used as a fallback before that setting loads.
 */
export const DEFAULT_BOOKING_HORIZON_DAYS = 7

/** Local calendar date as "yyyy-MM-dd" (never shifts across timezones). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** The inclusive [first, last] bookable dates as "yyyy-MM-dd" keys. */
export function bookingWindowKeys(
  now: Date = new Date(),
  horizonDays: number = DEFAULT_BOOKING_HORIZON_DAYS
): { todayKey: string; horizonKey: string } {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + horizonDays)
  return { todayKey: localDateKey(today), horizonKey: localDateKey(horizon) }
}

/** True when a "yyyy-MM-dd" date falls inside the bookable window. */
export function isWithinBookingHorizon(
  dateKey: string,
  now: Date = new Date(),
  horizonDays: number = DEFAULT_BOOKING_HORIZON_DAYS
): boolean {
  const { todayKey, horizonKey } = bookingWindowKeys(now, horizonDays)
  // ISO date strings compare correctly lexicographically
  return dateKey >= todayKey && dateKey <= horizonKey
}

export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

/**
 * A slot's full time range, e.g. "10:00 – 10:30 AM". The AM/PM marker is only
 * repeated when the slot straddles noon/midnight ("11:30 AM – 12:00 PM"), so
 * the common case stays short enough to read at a glance on a slot button.
 */
export function slotRangeLabel(startMin: number, endMin: number): string {
  // Normalise so a window ending at 24:00 reads as 12:00 AM rather than 24:00 PM.
  const norm = (min: number) => ((min % 1440) + 1440) % 1440
  const periodOf = (min: number) => (Math.floor(norm(min) / 60) >= 12 ? "PM" : "AM")
  const clockOf = (min: number) => {
    const h24 = Math.floor(norm(min) / 60)
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    return `${h12}:${String(norm(min) % 60).padStart(2, "0")}`
  }

  const startPeriod = periodOf(startMin)
  const endPeriod = periodOf(endMin)
  return startPeriod === endPeriod
    ? `${clockOf(startMin)} – ${clockOf(endMin)} ${endPeriod}`
    : `${clockOf(startMin)} ${startPeriod} – ${clockOf(endMin)} ${endPeriod}`
}

/**
 * Build the bookable slot grid between a window's start/end ("HH:mm"), stepping
 * by the configured slot length. An optional lunch break excludes
 * any slot that overlaps it, so that time isn't bookable.
 */
export function buildSlots(
  windowStart: string,
  windowEnd: string,
  lunch?: { start: string | null; end: string | null } | null,
  slotMinutes: number = DEFAULT_SLOT_MINUTES
): Slot[] {
  const step = Number.isFinite(slotMinutes) && slotMinutes > 0 ? Math.floor(slotMinutes) : DEFAULT_SLOT_MINUTES
  const startMin = parseHHMM(windowStart)
  const endMin = parseHHMM(windowEnd)
  const lunchStart = lunch?.start ? parseHHMM(lunch.start) : null
  const lunchEnd = lunch?.end ? parseHHMM(lunch.end) : null
  const hasLunch = lunchStart != null && lunchEnd != null && lunchEnd > lunchStart

  const out: Slot[] = []
  for (let m = startMin; m + step <= endMin; m += step) {
    // Skip a slot that overlaps the lunch break at all
    if (hasLunch && m < lunchEnd! && m + step > lunchStart!) continue
    out.push({ startMin: m, endMin: m + step })
  }
  return out
}
