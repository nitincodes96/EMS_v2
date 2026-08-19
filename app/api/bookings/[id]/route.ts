import { NextResponse } from "next/server"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"
import { appLink, displayName, mailBrandName, notifyUser } from "@/lib/notify"
import { notifyPaOfBooking } from "@/lib/booking-notify"
import { bookingClosedByAdminEmailHtml } from "@/lib/email-templates"
import { isValidWorkType } from "@/lib/work-types"
import { formatDuration } from "@/lib/booking-slots"
import { logEvent } from "@/lib/system-log"
import {
  checkBookingHorizon,
  checkSlotAvailability,
  isWithinChangeWindow,
  hasStarted,
  toBookingDate,
  DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES,
} from "@/lib/booking-rules"

const BOOKING_INCLUDE = {
  faculty: { select: { id: true, name: true, email: true, photoUrl: true } },
  pa: { select: { id: true, name: true, email: true, phoneNumber: true, photoUrl: true } },
  department: { select: { id: true, name: true, bookingChangeCutoffMinutes: true } },
} as const

function slotLabel(start: Date, end: Date) {
  return `${format(start, "h:mm a")}–${format(end, "h:mm a")}`
}

function dayLabel(date: Date) {
  return date.toISOString().slice(0, 10)
}

/** "2026-08-18 9:00 AM–10:00 AM" — how a booking reads in the system log. */
function bookingLabel(booking: { date: Date; startTime: Date; endTime: Date }) {
  return `${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)}`
}

/** Faculty who own the booking, the assigned PA, or an admin may view it. */
function canView(
  sessionRole: string,
  sessionId: string,
  booking: { facultyId: string; paId: string }
) {
  if (sessionRole === "ADMIN") return true
  if (sessionRole === "FACULTY") return booking.facultyId === sessionId
  return booking.paId === sessionId
}

// GET: full booking detail plus its activity log
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        ...BOOKING_INCLUDE,
        logs: {
          orderBy: { createdAt: "desc" },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    if (!canView(sessionUser.role, sessionUser.id, booking)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cutoffMinutes = booking.department.bookingChangeCutoffMinutes

    return NextResponse.json({
      booking,
      rules: {
        cutoffMinutes,
        // Computed server-side so the client can't fake an open window
        canChange: booking.status === "BOOKED" && isWithinChangeWindow(booking.startTime, cutoffMinutes),
        // Outcome can only be recorded once the slot has actually begun
        canRecordOutcome: booking.status === "BOOKED" && hasStarted(booking.startTime),
      },
    })
  } catch (error) {
    console.error("Error loading booking:", error)
    return NextResponse.json({ error: "Failed to load booking" }, { status: 500 })
  }
}

// PATCH: status changes (COMPLETED / ABSENT / CANCELLED) or a RESCHEDULE.
// Cancelling and rescheduling both release the slot, so both are blocked
// within the department's configured change-cutoff window of the start time.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Backs both the change-cutoff and booking-horizon checks below — fetched
  // once here since several branches (reschedule, cancel) need it.
  const department = await prisma.department.findUnique({
    where: { id: booking.departmentId },
    select: { bookingHorizonDays: true, bookingChangeCutoffMinutes: true },
  })
  const cutoffMinutes = department?.bookingChangeCutoffMinutes ?? DEFAULT_BOOKING_CHANGE_CUTOFF_MINUTES

  // The booking's faculty or an admin may change it; the assigned PA may only
  // self-report their work (handled as PA_REPORT below).
  const isAdmin = sessionUser.role === "ADMIN"
  const isOwnerFaculty = sessionUser.role === "FACULTY" && booking.facultyId === sessionUser.id
  const isAssignedPa = sessionUser.role === "PROJECT_ASSISTANT" && booking.paId === sessionUser.id
  if (!isAdmin && !isOwnerFaculty && !isAssignedPa) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const rawRemark = typeof body.remark === "string" ? body.remark.trim() : ""
    const remark = rawRemark ? rawRemark.slice(0, 1000) : null

    // ------------------------------------------------------------ PA report
    // The assigned PA reports whether they carried out the work. This is
    // advisory — the faculty still makes the final call on the booking status.
    if (body.action === "PA_REPORT") {
      if (!isAssignedPa && !isAdmin) {
        return NextResponse.json({ error: "Only the assigned PA can report their work" }, { status: 403 })
      }
      if (booking.status !== "BOOKED") {
        return NextResponse.json(
          { error: `This booking is already ${booking.status.toLowerCase()}` },
          { status: 409 }
        )
      }
      if (typeof body.done !== "boolean") {
        return NextResponse.json({ error: "done (true/false) is required" }, { status: 400 })
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          paStatus: body.done ? "DONE" : "NOT_DONE",
          paRemark: remark,
          paMarkedAt: new Date(),
        },
        include: BOOKING_INCLUDE,
      })

      await prisma.bookingLog.create({
        data: {
          bookingId: id,
          action: "PA_REPORTED",
          actorId: sessionUser.id,
          message: body.done ? "PA marked the work as done" : "PA marked the work as not done",
          remark,
        },
      })

      await logEvent({
        category: "BOOKING",
        action: body.done ? "Work reported done" : "Work reported not done",
        description: `${displayName(updated.pa)} reported the ${bookingLabel(updated)} booking for ${displayName(updated.faculty)} as ${body.done ? "done" : "not done"}${remark ? ` — ${remark}` : ""}`,
        actor: sessionUser,
        entityType: "Booking",
        entityId: id,
        departmentId: booking.departmentId,
      })

      await createNotification({
        userId: booking.facultyId,
        type: "BOOKING",
        title: "PA updated their work",
        message: `The PA marked ${dayLabel(booking.date)} ${slotLabel(
          booking.startTime,
          booking.endTime
        )} as ${body.done ? "done" : "not done"}.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })

      return NextResponse.json({ booking: updated })
    }

    // Everything past this point is faculty/admin only.
    if (!isOwnerFaculty && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Optional 1–5 star rating of the PA's work
    let rating: number | null = null
    if (body.rating != null && body.rating !== "") {
      const parsed = Number(body.rating)
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
        return NextResponse.json({ error: "Rating must be a whole number from 1 to 5" }, { status: 400 })
      }
      rating = parsed
    }

    // -------------------------------------------------------------------- rate
    // Rate (or re-rate) a booking the PA already carried out.
    if (body.action === "RATE") {
      if (rating == null) {
        return NextResponse.json({ error: "A rating from 1 to 5 is required" }, { status: 400 })
      }
      if (booking.status !== "COMPLETED") {
        return NextResponse.json(
          { error: "Only completed bookings can be rated" },
          { status: 409 }
        )
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { rating, ratedAt: new Date() },
        include: BOOKING_INCLUDE,
      })

      await prisma.bookingLog.create({
        data: {
          bookingId: id,
          action: "RATED",
          actorId: sessionUser.id,
          message: `Rated the PA ${rating}/5`,
          remark,
        },
      })

      await logEvent({
        category: "BOOKING",
        action: "Booking rated",
        description: `${displayName(updated.faculty)} rated ${displayName(updated.pa)} ${rating}/5 for the ${bookingLabel(updated)} booking`,
        actor: sessionUser,
        entityType: "Booking",
        entityId: id,
        departmentId: booking.departmentId,
      })

      return NextResponse.json({ booking: updated })
    }

    // ---------------------------------------------------------------- reschedule
    if (body.action === "RESCHEDULE") {
      const { date, startTime, endTime, workType, task } = body as {
        date: string
        startTime: string
        endTime: string
        workType?: string
        task?: string
      }

      if (!date || !startTime || !endTime) {
        return NextResponse.json({ error: "date, startTime and endTime are required" }, { status: 400 })
      }
      if (booking.status !== "BOOKED") {
        return NextResponse.json(
          { error: `A ${booking.status.toLowerCase()} booking can't be rescheduled` },
          { status: 409 }
        )
      }
      if (!isWithinChangeWindow(booking.startTime, cutoffMinutes)) {
        return NextResponse.json(
          {
            error: `Bookings can only be rescheduled more than ${formatDuration(cutoffMinutes)} before the start time`,
          },
          { status: 409 }
        )
      }
      if (workType != null && !isValidWorkType(workType)) {
        return NextResponse.json({ error: "Invalid work type" }, { status: 400 })
      }

      const newDate = toBookingDate(date)
      const newStart = new Date(`${date}T${startTime}`)
      const newEnd = new Date(`${date}T${endTime}`)

      const horizonError = checkBookingHorizon(newDate, department?.bookingHorizonDays ?? 7)
      if (horizonError) {
        return NextResponse.json({ error: horizonError.error }, { status: horizonError.status })
      }

      const unavailable = await checkSlotAvailability({
        paId: booking.paId,
        bookingDate: newDate,
        start: newStart,
        end: newEnd,
        excludeBookingId: booking.id,
      })
      if (unavailable) {
        return NextResponse.json({ error: unavailable.error }, { status: unavailable.status })
      }

      const previous = `${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)}`
      const next = `${date} ${slotLabel(newStart, newEnd)}`

      const updated = await prisma.booking.update({
        where: { id },
        data: {
          date: newDate,
          startTime: newStart,
          endTime: newEnd,
          ...(workType != null ? { workType } : {}),
          ...(task?.trim() ? { task: task.trim() } : {}),
        },
        include: BOOKING_INCLUDE,
      })

      await prisma.bookingLog.create({
        data: {
          bookingId: id,
          action: "RESCHEDULED",
          actorId: sessionUser.id,
          message: `Rescheduled from ${previous} to ${next}`,
          remark,
        },
      })

      await logEvent({
        category: "BOOKING",
        action: "Booking rescheduled",
        description: `${displayName(updated.faculty)}'s booking with ${displayName(updated.pa)} moved from ${previous} to ${next}${remark ? ` — ${remark}` : ""}`,
        actor: sessionUser,
        entityType: "Booking",
        entityId: id,
        departmentId: booking.departmentId,
      })

      await notifyPaOfBooking({
        bookingId: id,
        event: "RESCHEDULED",
        pa: updated.pa,
        faculty: updated.faculty,
        departmentId: updated.departmentId,
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        task: updated.task,
        workType: updated.workType,
        note: remark,
        previousLabel: previous,
      })

      return NextResponse.json({ booking: updated })
    }

    // ------------------------------------------------------------------- status
    const status = body.status as "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"
    if (!["COMPLETED", "INCOMPLETE", "ABSENT", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    if (booking.status !== "BOOKED") {
      return NextResponse.json(
        { error: `This booking is already ${booking.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    // An admin closing a booking is an override — used precisely for the cases
    // (stuck/forgotten bookings, unblocking a department switch) where the
    // normal timing rules would otherwise get in the way — so those rules
    // don't apply to them. A remark is required instead, to keep an audit trail.
    if (isAdmin) {
      if (!remark) {
        return NextResponse.json(
          { error: "A remark is required when an admin closes a booking" },
          { status: 400 }
        )
      }
    } else {
      // Completed / incomplete / absent can only be recorded once the slot has begun
      if (status !== "CANCELLED" && !hasStarted(booking.startTime)) {
        return NextResponse.json(
          { error: "You can only record the outcome once the booking's start time has passed" },
          { status: 409 }
        )
      }

      if (status === "CANCELLED" && !isWithinChangeWindow(booking.startTime, cutoffMinutes)) {
        return NextResponse.json(
          {
            error: `Bookings can only be cancelled more than ${formatDuration(cutoffMinutes)} before the start time`,
          },
          { status: 409 }
        )
      }
    }

    // A rating may accompany marking the booking complete
    const ratingOnComplete = status === "COMPLETED" ? rating : null

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status,
        ...(ratingOnComplete != null ? { rating: ratingOnComplete, ratedAt: new Date() } : {}),
      },
      include: BOOKING_INCLUDE,
    })

    const LOG_ACTION_BY_STATUS = {
      CANCELLED: "CANCELLED",
      COMPLETED: "COMPLETED",
      INCOMPLETE: "MARKED_INCOMPLETE",
      ABSENT: "MARKED_ABSENT",
    } as const
    const logAction = LOG_ACTION_BY_STATUS[status]
    const baseLogMessage =
      status === "CANCELLED"
        ? `Cancelled ${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)}`
        : status === "COMPLETED"
          ? `Marked as completed${ratingOnComplete != null ? ` · rated ${ratingOnComplete}/5` : ""}`
          : status === "INCOMPLETE"
            ? "Marked as not completed"
            : "PA marked absent for this slot"
    // Flagged distinctly since this bypasses the faculty/PA-facing timing rules.
    const logMessage = isAdmin ? `[Admin override] ${baseLogMessage}` : baseLogMessage

    await prisma.bookingLog.create({
      data: { bookingId: id, action: logAction, actorId: sessionUser.id, message: logMessage, remark },
    })

    const STATUS_ACTION = {
      CANCELLED: "Booking cancelled",
      COMPLETED: "Booking completed",
      INCOMPLETE: "Booking marked incomplete",
      ABSENT: "PA marked absent",
    } as const

    await logEvent({
      category: "BOOKING",
      action: isAdmin ? `${STATUS_ACTION[status]} (admin)` : STATUS_ACTION[status],
      description: `${displayName(updated.faculty)}'s ${bookingLabel(updated)} booking with ${displayName(updated.pa)} was ${status.toLowerCase()}${isAdmin ? " by an admin" : ""}${remark ? ` — ${remark}` : ""}`,
      actor: sessionUser,
      entityType: "Booking",
      entityId: id,
      departmentId: booking.departmentId,
    })

    // Neither party initiated this, so both need to hear it from us — on the
    // dashboard and by email, same as every other faculty/PA-facing update.
    if (isAdmin) {
      const STATUS_LABEL: Record<typeof status, string> = {
        COMPLETED: "Completed",
        INCOMPLETE: "Not completed",
        ABSENT: "Absent",
        CANCELLED: "Cancelled",
      }
      const statusLabel = STATUS_LABEL[status]
      const paDisplayName = displayName(updated.pa)
      const brandName = await mailBrandName()

      await notifyUser({
        userId: booking.facultyId,
        type: "BOOKING",
        title: "An admin closed your booking",
        message: `Your ${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)} booking with ${paDisplayName} was marked ${statusLabel.toLowerCase()} by an admin.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
        email: {
          to: updated.faculty.email,
          subject: `Booking ${statusLabel.toLowerCase()} by an admin · ${dayLabel(booking.date)}`,
          html: bookingClosedByAdminEmailHtml({
            facultyName: displayName(updated.faculty),
            paName: paDisplayName,
            statusLabel,
            departmentName: updated.department?.name ?? "—",
            dateLabel: dayLabel(booking.date),
            slotLabel: slotLabel(booking.startTime, booking.endTime),
            note: remark,
            bookingLink: appLink(`/faculty/bookings/${id}`),
            brandName,
          }),
        },
      })
    }

    const facultyDisplayName = displayName(updated.faculty)
    const slot = `${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)}`

    if (status === "COMPLETED") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Booking marked completed",
        message: isAdmin
          ? `An admin marked your ${slot} booking as completed on ${facultyDisplayName}'s behalf.${ratingOnComplete != null ? ` Rated ${ratingOnComplete}/5.` : ""}${remark ? ` Note: ${remark}` : ""}`
          : `Your ${slot} booking was marked completed.${ratingOnComplete != null ? ` Rated ${ratingOnComplete}/5.` : ""}${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })
    } else if (status === "INCOMPLETE") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Booking marked not completed",
        message: isAdmin
          ? `An admin marked your ${slot} slot as not completed on ${facultyDisplayName}'s behalf.${remark ? ` Note: ${remark}` : ""}`
          : `Your ${slot} slot was marked as not completed.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })
    } else if (status === "ABSENT") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Marked absent",
        message: isAdmin
          ? `An admin marked you absent for the ${slot} slot on ${facultyDisplayName}'s behalf.${remark ? ` Note: ${remark}` : ""}`
          : `You were marked absent for the ${slot} slot.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })
    } else if (status === "CANCELLED") {
      await notifyPaOfBooking({
        bookingId: id,
        event: "CANCELLED",
        pa: updated.pa,
        faculty: updated.faculty,
        departmentId: updated.departmentId,
        date: updated.date,
        startTime: updated.startTime,
        endTime: updated.endTime,
        task: updated.task,
        workType: updated.workType,
        note: remark,
        actedByAdmin: isAdmin,
      })
    }

    return NextResponse.json({ booking: updated })
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 })
  }
}
