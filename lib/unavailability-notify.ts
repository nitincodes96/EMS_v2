import type { UnavailabilityNotice } from "@prisma/client"

import prisma from "@/lib/prisma"
import { bookingSlotLabel } from "@/lib/booking-notify"
import {
  unavailabilityAdminEmailHtml,
  unavailabilityFacultyEmailHtml,
  unavailabilityRevertedEmailHtml,
} from "@/lib/email-templates"
import { appLink, displayName, mailBrandName, notifyUsers } from "@/lib/notify"
import { noticeDateLabel, noticeWindow, windowLabel } from "@/lib/unavailability"

type PersonRef = { id: string; name: string | null; email: string | null }

export type AffectedBooking = {
  id: string
  startTime: Date
  endTime: Date
  task: string
  workType: string | null
  faculty: PersonRef
}

/**
 * Fan-out for a new unavailability notice: every admin hears about it, and so
 * does each faculty member holding a BOOKED slot inside the window. Both get
 * the dashboard bell plus an email. Delivery problems are swallowed by
 * notifyUsers so a flaky mail server can never lose the notice itself.
 */
export async function notifyOfUnavailability(input: {
  notice: UnavailabilityNotice
  pa: PersonRef
  departmentName: string
  affected: AffectedBooking[]
}) {
  const { notice, pa, departmentName, affected } = input
  const paName = displayName(pa)
  const dateLabel = noticeDateLabel(notice.date)
  const window = windowLabel(noticeWindow(notice))

  const [admins, brandName] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, name: true, email: true },
    }),
    mailBrandName(),
  ])

  const adminMessage = `${paName} (${departmentName}) won't be available on ${dateLabel} · ${window}.${
    affected.length > 0 ? ` ${affected.length} existing booking${affected.length === 1 ? "" : "s"} affected.` : ""
  }${notice.reason ? ` Reason: ${notice.reason}` : ""}`

  await notifyUsers([
    ...admins.map((admin) => ({
      userId: admin.id,
      type: "UNAVAILABILITY" as const,
      title: "PA unavailable",
      message: adminMessage,
      refId: notice.id,
      email: {
        to: admin.email,
        subject: `${paName} unavailable · ${dateLabel}`,
        html: unavailabilityAdminEmailHtml({
          brandName,
          adminName: displayName(admin),
          paName,
          departmentName,
          dateLabel,
          windowLabel: window,
          reason: notice.reason,
          affectedBookings: affected.length,
          link: appLink("/admin/unavailability"),
        }),
      },
    })),
    ...affected.map((booking) => {
      const slot = bookingSlotLabel(booking.startTime, booking.endTime)
      return {
        userId: booking.faculty.id,
        type: "UNAVAILABILITY" as const,
        title: "Your PA won't be available",
        message: `${paName} won't be in on ${dateLabel} (${window}), which overlaps your ${slot} booking with them.${
          notice.reason ? ` Reason: ${notice.reason}` : ""
        } Consider rescheduling or booking another PA.`,
        refId: booking.id,
        email: {
          to: booking.faculty.email,
          subject: `${paName} unavailable for your ${dateLabel} booking`,
          html: unavailabilityFacultyEmailHtml({
            brandName,
            facultyName: displayName(booking.faculty),
            paName,
            dateLabel,
            windowLabel: window,
            slotLabel: slot,
            task: booking.task,
            workType: booking.workType,
            reason: notice.reason,
            bookingLink: appLink(`/faculty/bookings/${booking.id}`),
          }),
        },
      }
    }),
  ])
}

/**
 * When a notice is withdrawn the same people get a short in-app follow-up so
 * nobody keeps planning around a gap that no longer exists. No email — it's
 * good news and the bell is enough. When an admin reverted it on the PA's
 * behalf, the PA is told (with the admin's remark) on both channels, since
 * they're now expected to turn up.
 */
export async function notifyOfWithdrawal(input: {
  notice: UnavailabilityNotice
  pa: PersonRef
  departmentName: string
  affected: AffectedBooking[]
  /** True when an admin reverted the notice rather than the PA withdrawing it. */
  revertedByAdmin?: boolean
  remark?: string | null
}) {
  const { notice, pa, departmentName, affected, revertedByAdmin, remark } = input
  const paName = displayName(pa)
  const dateLabel = noticeDateLabel(notice.date)
  const window = windowLabel(noticeWindow(notice))

  const [admins, brandName] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    }),
    revertedByAdmin ? mailBrandName() : Promise.resolve(""),
  ])

  await notifyUsers([
    ...(revertedByAdmin
      ? [
          {
            userId: pa.id,
            type: "UNAVAILABILITY" as const,
            title: "Your unavailability was reverted",
            message: `An admin reverted your unavailability notice for ${dateLabel} (${window}). You're marked available and bookable again for that time.${
              remark ? ` Note: ${remark}` : ""
            }`,
            refId: notice.id,
            email: {
              to: pa.email,
              subject: `Your unavailability for ${dateLabel} was reverted`,
              html: unavailabilityRevertedEmailHtml({
                brandName,
                paName,
                dateLabel,
                windowLabel: window,
                remark,
                link: appLink("/project-assistant/unavailability"),
              }),
            },
          },
        ]
      : []),
    ...admins.map((admin) => ({
      userId: admin.id,
      type: "UNAVAILABILITY" as const,
      title: "PA available again",
      message: revertedByAdmin
        ? `${paName}'s (${departmentName}) unavailability for ${dateLabel} · ${window} was reverted by an admin. Their slots are open again.`
        : `${paName} (${departmentName}) withdrew their unavailability for ${dateLabel} · ${window}. Their slots are open again.`,
      refId: notice.id,
    })),
    ...affected.map((booking) => ({
      userId: booking.faculty.id,
      type: "UNAVAILABILITY" as const,
      title: "Your PA is available again",
      message: `${paName} is now available on ${dateLabel} (${window}) — your ${bookingSlotLabel(
        booking.startTime,
        booking.endTime
      )} booking with them can go ahead as planned.`,
      refId: booking.id,
    })),
  ])
}
