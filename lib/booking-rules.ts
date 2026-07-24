import prisma from "@/lib/prisma"

// A booking may only be cancelled or rescheduled up to this many minutes
// before its start time. Rescheduling releases the original slot exactly like
// a cancellation does, so the same cutoff applies to both.
export const BOOKING_CHANGE_CUTOFF_MINUTES = 60

export const BOOKING_CHANGE_RULE_TEXT =
  "Can be cancelled or rescheduled until 1 hour before the start time."

/** True while the booking is still outside the cutoff window. */
export function isWithinChangeWindow(startTime: Date, now: Date = new Date()): boolean {
  return startTime.getTime() - now.getTime() > BOOKING_CHANGE_CUTOFF_MINUTES * 60 * 1000
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
