import prisma from "@/lib/prisma"
import type { ScheduleSettings } from "@prisma/client"

/**
 * The organization-wide work schedule and booking rules. Every department
 * shares the single ScheduleSettings row (id = "global"), so this is the only
 * place that should read it — call sites never query the table directly.
 */

export const SCHEDULE_SETTINGS_ID = "global"

/** Column defaults, mirrored from the Prisma schema for the client side. */
export const DEFAULT_SCHEDULE_SETTINGS = {
  workingDays: "Mon,Tue,Wed,Thu,Fri",
  shiftStartTime: "09:00",
  shiftEndTime: "18:00",
  lateGraceMinutes: 5,
  lunchStartTime: null as string | null,
  lunchEndTime: null as string | null,
  bookingEnabled: true,
  facultyBookingLimit: 3,
  maxSlotsPerBooking: 0,
  slotDurationMinutes: 30,
  bookingHorizonDays: 7,
  bookingChangeCutoffMinutes: 60,
}

export type ScheduleSettingsInput = typeof DEFAULT_SCHEDULE_SETTINGS

/** The shared settings row, created with defaults on first read. */
export async function getScheduleSettings(): Promise<ScheduleSettings> {
  return prisma.scheduleSettings.upsert({
    where: { id: SCHEDULE_SETTINGS_ID },
    update: {},
    create: { id: SCHEDULE_SETTINGS_ID },
  })
}

/** Working days as a Set of weekday abbreviations ("Mon", "Tue", …). */
export function workingDaySet(workingDays: string): Set<string> {
  return new Set(
    workingDays
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
  )
}

/** Minute-of-day after which a punch counts as late (shift start + grace). */
export function lateAfterMinutes(settings: Pick<ScheduleSettings, "shiftStartTime" | "lateGraceMinutes">): number {
  const [h, m] = settings.shiftStartTime.split(":").map(Number)
  return (h || 0) * 60 + (m || 0) + settings.lateGraceMinutes
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Validates an admin's settings payload. Returns the clean values or a
 * message describing the first problem. Shared by the settings API so the
 * rules live in one place.
 */
export function parseScheduleSettings(
  body: Record<string, unknown>,
  current: ScheduleSettingsInput
): { ok: true; value: ScheduleSettingsInput } | { ok: false; error: string } {
  const str = (key: keyof ScheduleSettingsInput, fallback: string | null) => {
    const raw = body[key]
    if (raw == null) return fallback
    return String(raw).trim()
  }
  const int = (key: keyof ScheduleSettingsInput, fallback: number) => {
    const raw = body[key]
    if (raw == null || raw === "") return fallback
    const n = Number(raw)
    return Number.isInteger(n) ? n : NaN
  }

  const workingDays = (str("workingDays", current.workingDays) ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
  const validDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
  if (workingDays.length === 0 || workingDays.some((d) => !validDays.has(d))) {
    return { ok: false, error: "Select at least one valid working day" }
  }

  const shiftStartTime = str("shiftStartTime", current.shiftStartTime) || current.shiftStartTime
  const shiftEndTime = str("shiftEndTime", current.shiftEndTime) || current.shiftEndTime
  if (!HHMM.test(shiftStartTime) || !HHMM.test(shiftEndTime)) {
    return { ok: false, error: "Shift times must be in HH:mm format" }
  }
  if (shiftEndTime <= shiftStartTime) {
    return { ok: false, error: "Shift end time must be after the start time" }
  }

  const lateGraceMinutes = int("lateGraceMinutes", current.lateGraceMinutes)
  if (isNaN(lateGraceMinutes) || lateGraceMinutes < 0 || lateGraceMinutes > 180) {
    return { ok: false, error: "Grace window must be between 0 and 180 minutes" }
  }

  // Optional lunch break — both times or neither (empty clears it)
  const lunchStartRaw = str("lunchStartTime", current.lunchStartTime) || ""
  const lunchEndRaw = str("lunchEndTime", current.lunchEndTime) || ""
  if (Boolean(lunchStartRaw) !== Boolean(lunchEndRaw)) {
    return { ok: false, error: "Provide both lunch start and end, or leave both empty" }
  }
  if (lunchStartRaw && (!HHMM.test(lunchStartRaw) || !HHMM.test(lunchEndRaw))) {
    return { ok: false, error: "Lunch times must be in HH:mm format" }
  }
  if (lunchStartRaw && lunchEndRaw <= lunchStartRaw) {
    return { ok: false, error: "Lunch end time must be after the start time" }
  }

  const bookingEnabledRaw = body.bookingEnabled
  const bookingEnabled =
    bookingEnabledRaw == null
      ? current.bookingEnabled
      : bookingEnabledRaw === true || bookingEnabledRaw === "true"

  const facultyBookingLimit = int("facultyBookingLimit", current.facultyBookingLimit)
  if (isNaN(facultyBookingLimit) || facultyBookingLimit < 0) {
    return { ok: false, error: "Booking limit must be a non-negative number" }
  }

  const maxSlotsPerBooking = int("maxSlotsPerBooking", current.maxSlotsPerBooking)
  if (isNaN(maxSlotsPerBooking) || maxSlotsPerBooking < 0 || maxSlotsPerBooking > 96) {
    return { ok: false, error: "Slots per booking must be between 0 (unlimited) and 96" }
  }

  const slotDurationMinutes = int("slotDurationMinutes", current.slotDurationMinutes)
  if (isNaN(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 480) {
    return { ok: false, error: "Slot duration must be between 5 and 480 minutes" }
  }

  const bookingHorizonDays = int("bookingHorizonDays", current.bookingHorizonDays)
  if (isNaN(bookingHorizonDays) || bookingHorizonDays < 1 || bookingHorizonDays > 90) {
    return { ok: false, error: "Booking window must be between 1 and 90 days" }
  }

  const bookingChangeCutoffMinutes = int("bookingChangeCutoffMinutes", current.bookingChangeCutoffMinutes)
  if (isNaN(bookingChangeCutoffMinutes) || bookingChangeCutoffMinutes < 0 || bookingChangeCutoffMinutes > 2880) {
    return { ok: false, error: "Change cutoff must be between 0 and 2880 minutes (48 hours)" }
  }

  return {
    ok: true,
    value: {
      workingDays: workingDays.join(","),
      shiftStartTime,
      shiftEndTime,
      lateGraceMinutes,
      lunchStartTime: lunchStartRaw || null,
      lunchEndTime: lunchEndRaw || null,
      bookingEnabled,
      facultyBookingLimit,
      maxSlotsPerBooking,
      slotDurationMinutes,
      bookingHorizonDays,
      bookingChangeCutoffMinutes,
    },
  }
}

const SETTING_LABELS: Record<keyof ScheduleSettingsInput, string> = {
  workingDays: "working days",
  shiftStartTime: "shift start",
  shiftEndTime: "shift end",
  lateGraceMinutes: "grace window",
  lunchStartTime: "lunch start",
  lunchEndTime: "lunch end",
  bookingEnabled: "booking",
  facultyBookingLimit: "faculty booking limit",
  maxSlotsPerBooking: "slots per booking",
  slotDurationMinutes: "slot duration",
  bookingHorizonDays: "booking window",
  bookingChangeCutoffMinutes: "change cutoff",
}

function formatSetting(value: string | number | boolean | null): string {
  if (value === null || value === "") return "none"
  if (typeof value === "boolean") return value ? "on" : "off"
  return String(value)
}

/**
 * Names the settings that actually changed, so the audit trail reads
 * "slot duration 30 → 60" rather than just "updated".
 */
export function describeScheduleChanges(before: ScheduleSettingsInput, after: ScheduleSettingsInput): string {
  const changes: string[] = []
  for (const key of Object.keys(SETTING_LABELS) as (keyof ScheduleSettingsInput)[]) {
    if (before[key] !== after[key]) {
      changes.push(`${SETTING_LABELS[key]} ${formatSetting(before[key])} → ${formatSetting(after[key])}`)
    }
  }
  return changes.length > 0 ? `Updated schedule settings: ${changes.join(", ")}` : "Saved schedule settings (no changes)"
}
