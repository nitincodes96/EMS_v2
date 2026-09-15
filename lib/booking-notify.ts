import { format } from "date-fns"

import prisma from "@/lib/prisma"
import { bookingEmailHtml, type BookingEmailLocation } from "@/lib/email-templates"
import { appLink, displayName, mailBrandName, notifyUser } from "@/lib/notify"

/**
 * Booking.date is stored as @db.Date (UTC midnight), so it is formatted in UTC
 * to keep the calendar day the faculty picked. startTime/endTime are real
 * instants built from the department's wall-clock times and are formatted in
 * server-local time, matching how the booking screens render them.
 */
const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

export function bookingDayLabel(date: Date): string {
  return DAY_LABEL.format(date)
}

export function bookingSlotLabel(start: Date, end: Date): string {
  return `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`
}

/** Department name plus every organization attendance location, for the "where to report" block. */
export async function loadBookingLocations(departmentId: string): Promise<{
  departmentName: string
  locations: BookingEmailLocation[]
}> {
  const [department, locations] = await Promise.all([
    prisma.department.findUnique({ where: { id: departmentId }, select: { name: true } }),
    prisma.attendanceLocation.findMany({
      select: { name: true, latitude: true, longitude: true, radiusMeters: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  return {
    departmentName: department?.name ?? "Your department",
    locations,
  }
}

type BookingEvent = "CREATED" | "RESCHEDULED" | "CANCELLED"

const COPY: Record<BookingEvent, { heading: string; subject: string; title: string }> = {
  CREATED: {
    heading: "You have a new booking",
    subject: "New booking assigned",
    title: "New task assigned",
  },
  RESCHEDULED: {
    heading: "Your booking has moved",
    subject: "Booking rescheduled",
    title: "Booking rescheduled",
  },
  CANCELLED: {
    heading: "Your booking was cancelled",
    subject: "Booking cancelled",
    title: "Booking cancelled",
  },
}

type PersonRef = { id?: string; name?: string | null; email?: string | null }

/**
 * Tells a Project Assistant about a booking on both channels — the dashboard
 * bell and email. The email carries the full picture (who booked them, the
 * slot, the task and the department location with coordinates) so the PA does
 * not have to open the portal to know where to be and what to do.
 */
export async function notifyPaOfBooking(input: {
  bookingId: string
  event: BookingEvent
  pa: PersonRef & { id: string }
  faculty: PersonRef
  departmentId: string
  date: Date
  startTime: Date
  endTime: Date
  task: string
  workType?: string | null
  /** Free-text remark from the faculty (reschedule/cancel reason). */
  note?: string | null
  /** Previous "date slot" text, shown on a reschedule. */
  previousLabel?: string | null
  /** True when an admin performed this on the faculty's behalf (override), not the faculty themselves. */
  actedByAdmin?: boolean
}) {
  const { heading, subject, title } = COPY[input.event]
  const facultyName = displayName(input.faculty)
  const dayLabel = bookingDayLabel(input.date)
  const slotLabel = bookingSlotLabel(input.startTime, input.endTime)
  const actor = input.actedByAdmin ? "An admin" : facultyName

  const [{ departmentName, locations }, brandName] = await Promise.all([
    loadBookingLocations(input.departmentId),
    mailBrandName(),
  ])

  const intro =
    input.event === "CREATED"
      ? `${facultyName} has booked you for the slot below. Here is everything you need for it.`
      : input.event === "RESCHEDULED"
        ? `${facultyName} moved your booking${input.previousLabel ? ` from ${input.previousLabel}` : ""}. The updated details are below.`
        : input.actedByAdmin
          ? `${actor} cancelled the booking below on ${facultyName}'s behalf. You are free for this slot.`
          : `${actor} cancelled the booking below. You are free for this slot.`

  const message =
    input.event === "CREATED"
      ? `${facultyName} booked you for ${slotLabel} on ${dayLabel}${input.task.trim() ? `: ${input.task}` : ""}`
      : input.event === "RESCHEDULED"
        ? `Your booking${input.previousLabel ? ` moved from ${input.previousLabel}` : " moved"} to ${dayLabel}, ${slotLabel}.${input.note ? ` Note: ${input.note}` : ""}`
        : input.actedByAdmin
          ? `An admin cancelled your ${dayLabel} ${slotLabel} slot (originally booked by ${facultyName}).${input.note ? ` Note: ${input.note}` : ""}`
          : `${actor} cancelled your ${dayLabel} ${slotLabel} slot.${input.note ? ` Note: ${input.note}` : ""}`

  return notifyUser({
    userId: input.pa.id,
    type: "BOOKING",
    title,
    message,
    refId: input.bookingId,
    email: {
      to: input.pa.email,
      subject: `${subject} · ${dayLabel}, ${slotLabel}`,
      html: bookingEmailHtml({
        heading,
        intro,
        brandName,
        paName: displayName(input.pa),
        facultyName,
        cancelledByAdmin: input.event === "CANCELLED" ? input.actedByAdmin : undefined,
        departmentName,
        dateLabel: dayLabel,
        slotLabel,
        task: input.task,
        workType: input.workType,
        locations,
        note: input.note,
        bookingLink: appLink(`/project-assistant/tasks`),
      }),
    },
  })
}
