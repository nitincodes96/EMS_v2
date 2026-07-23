// Shared time helpers for the PA booking calendar. Slots are whole hours
// within the department's booking window.

export type Slot = { startMin: number; endMin: number }

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
