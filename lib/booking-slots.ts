// Shared time helpers for the PA booking calendar. Slots are whole hours
// within the department's booking window.
//
// Pure module (no Prisma) so it can be imported from client components.

export type Slot = { startMin: number; endMin: number }

/**
 * How far ahead a booking may be made. A slot can be booked from today up to
 * and including this many days from today.
 */
export const BOOKING_HORIZON_DAYS = 7

/** Local calendar date as "yyyy-MM-dd" (never shifts across timezones). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** The inclusive [first, last] bookable dates as "yyyy-MM-dd" keys. */
export function bookingWindowKeys(now: Date = new Date()): { todayKey: string; horizonKey: string } {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + BOOKING_HORIZON_DAYS)
  return { todayKey: localDateKey(today), horizonKey: localDateKey(horizon) }
}

/** True when a "yyyy-MM-dd" date falls inside the bookable window. */
export function isWithinBookingHorizon(dateKey: string, now: Date = new Date()): boolean {
  const { todayKey, horizonKey } = bookingWindowKeys(now)
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

// Build hourly slots between a window's start/end ("HH:mm").
export function buildHourlySlots(windowStart: string, windowEnd: string): Slot[] {
  const startMin = parseHHMM(windowStart)
  const endMin = parseHHMM(windowEnd)
  const out: Slot[] = []
  for (let m = startMin; m + 60 <= endMin; m += 60) {
    out.push({ startMin: m, endMin: m + 60 })
  }
  return out
}
