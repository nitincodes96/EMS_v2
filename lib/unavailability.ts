import { format } from "date-fns"
import type { UnavailabilityNotice } from "@prisma/client"

import prisma from "@/lib/prisma"
import { parseHHMM } from "@/lib/booking-slots"

/**
 * Shared helpers for Project Assistant unavailability notices — the "I won't
 * be in on <day> (from X to Y)" heads-up that replaces leave. A notice is
 * either whole-day (no times) or a "HH:mm" window inside the day.
 */

export type UnavailabilityWindow = {
  id: string
  wholeDay: boolean
  /** "HH:mm", null for a whole-day notice */
  start: string | null
  end: string | null
  reason: string | null
}

export function noticeWindow(n: Pick<UnavailabilityNotice, "id" | "startTime" | "endTime" | "reason">): UnavailabilityWindow {
  const wholeDay = !n.startTime || !n.endTime
  return {
    id: n.id,
    wholeDay,
    start: wholeDay ? null : n.startTime,
    end: wholeDay ? null : n.endTime,
    reason: n.reason,
  }
}

/** True when the notice covers any part of the [start, end) slot (minutes of day). */
export function windowBlocksRange(w: UnavailabilityWindow, startMin: number, endMin: number): boolean {
  if (w.wholeDay) return true
  return parseHHMM(w.start!) < endMin && parseHHMM(w.end!) > startMin
}

/** Same check for a booking's real start/end instants (server-local wall clock). */
export function windowBlocksBooking(w: UnavailabilityWindow, start: Date, end: Date): boolean {
  return windowBlocksRange(w, parseHHMM(format(start, "HH:mm")), parseHHMM(format(end, "HH:mm")))
}

/** Active notices for one PA on one @db.Date day. */
export async function activeNoticesFor(userId: string, date: Date) {
  return prisma.unavailabilityNotice.findMany({
    where: { userId, date, status: "ACTIVE" },
    orderBy: { startTime: "asc" },
  })
}

/** Human label for the window, e.g. "all day" or "10:00 AM – 1:00 PM". */
export function windowLabel(w: Pick<UnavailabilityWindow, "wholeDay" | "start" | "end">): string {
  if (w.wholeDay || !w.start || !w.end) return "all day"
  return `${toLabel(w.start)} – ${toLabel(w.end)}`
}

function toLabel(hhmm: string): string {
  const min = parseHHMM(hhmm)
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const period = h24 >= 12 ? "PM" : "AM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, "0")} ${period}`
}

/** "Mon, 14 Sep 2026" for a @db.Date value, formatted in UTC so the day never slips. */
const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function noticeDateLabel(date: Date): string {
  return DATE_LABEL.format(date)
}
