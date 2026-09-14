import prisma from "@/lib/prisma"
import { DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES, formatDuration } from "@/lib/booking-slots"
import { activeNoticesFor, noticeWindow, windowBlocksBooking, windowLabel } from "@/lib/unavailability"

// Rescheduling releases the original slot exactly like a cancellation does, so
// the same cutoff (ScheduleSettings.bookingChangeCutoffMinutes) applies to both.
export { DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES }

/** True while the booking is still outside the cutoff window. */
export function isWithinChangeWindow(
  startTime: Date,
  cutoffMinutes: number = DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES,
  now: Date = new Date()
): boolean {
  return startTime.getTime() - now.getTime() > cutoffMinutes * 60 * 1000
}

/**
 * True once the slot has begun. An outcome (completed / absent) can only be
 * recorded after this — before the slot starts there's nothing to report on.
 */
export function hasStarted(startTime: Date, now: Date = new Date()): boolean {
  return now.getTime() >= startTime.getTime()
}

/** Build the UTC-midnight Date used for the Booking.date (@db.Date) column. */
export function toBookingDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

/**
 * Guard for how far ahead a booking may be dated, per the organization's
 * configured booking window (ScheduleSettings.bookingHorizonDays). This was
 * previously only enforced client-side (the calendar just didn't render
 * later days) — a crafted request could book/reschedule to any date. Dates
 * are compared as UTC calendar days, matching how toBookingDate stores them.
 */
export function checkBookingHorizon(
  bookingDate: Date,
  horizonDays: number,
  now: Date = new Date()
): { error: string; status: number } | null {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const horizonUtc = todayUtc + horizonDays * 24 * 60 * 60 * 1000
  const target = bookingDate.getTime()

  if (target < todayUtc) {
    return { error: "You can't book a past date", status: 400 }
  }
  if (target > horizonUtc) {
    return { error: `Bookings can only be made up to ${horizonDays} day${horizonDays === 1 ? "" : "s"} ahead`, status: 400 }
  }
  return null
}

/**
 * Guard for how many consecutive slots one booking may span
 * (ScheduleSettings.maxSlotsPerBooking, 0 = unlimited). The calendar only
 * lets a faculty pick up to the limit, but the request itself is what's
 * trusted. A range that isn't a whole number of slots is rejected too.
 */
export function checkSlotCount(
  start: Date,
  end: Date,
  slotDurationMinutes: number,
  maxSlotsPerBooking: number
): { error: string; status: number } | null {
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000)
  if (minutes <= 0) return { error: "Invalid time slot", status: 400 }
  if (slotDurationMinutes > 0 && minutes % slotDurationMinutes !== 0) {
    return { error: `Bookings must be made in ${formatDuration(slotDurationMinutes)} slots`, status: 400 }
  }
  if (maxSlotsPerBooking > 0 && minutes > maxSlotsPerBooking * slotDurationMinutes) {
    return {
      error: `A booking can span at most ${maxSlotsPerBooking} slot${maxSlotsPerBooking === 1 ? "" : "s"} (${formatDuration(maxSlotsPerBooking * slotDurationMinutes)})`,
      status: 400,
    }
  }
  return null
}

/**
 * A faculty's still-open (BOOKED) bookings within a department — what counts
 * against ScheduleSettings.facultyBookingLimit. Only closing (completing/
 * cancelling/etc.) a booking frees up room for another one.
 */
export async function countActiveFacultyBookings(facultyId: string, departmentId: string): Promise<number> {
  return prisma.booking.count({ where: { facultyId, departmentId, status: "BOOKED" } })
}

/**
 * Shared availability guard for creating or rescheduling a booking.
 * Returns an error message + HTTP status, or null when the slot is free.
 */
export async function checkSlotAvailability({
  paId,
  bookingDate,
  start,
  end,
  excludeBookingId,
}: {
  paId: string
  bookingDate: Date
  start: Date
  end: Date
  excludeBookingId?: string
}): Promise<{ error: string; status: number } | null> {
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return { error: "Invalid time slot", status: 400 }
  }

  // Approved leave blocks the whole day (FR-6.7)
  const onLeave = await prisma.leave.findFirst({
    where: {
      userId: paId,
      status: "APPROVED",
      startDate: { lte: bookingDate },
      endDate: { gte: bookingDate },
    },
  })
  if (onLeave) {
    return { error: "PA is on approved leave for that date", status: 409 }
  }

  // The PA has said they won't be in — for the whole day or for a window
  // that overlaps this slot.
  const notices = await activeNoticesFor(paId, bookingDate)
  const blocking = notices.map(noticeWindow).find((w) => windowBlocksBooking(w, start, end))
  if (blocking) {
    return {
      error: blocking.wholeDay
        ? "PA has marked themselves unavailable for that day"
        : `PA has marked themselves unavailable ${windowLabel(blocking)} that day`,
      status: 409,
    }
  }

  // No overlapping active booking for the same PA
  const overlap = await prisma.booking.findFirst({
    where: {
      paId,
      date: bookingDate,
      status: { in: ["BOOKED", "COMPLETED"] },
      startTime: { lt: end },
      endTime: { gt: start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  })
  if (overlap) {
    return { error: "PA already has a booking overlapping this slot", status: 409 }
  }

  return null
}
