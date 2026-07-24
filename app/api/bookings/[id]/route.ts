import { NextResponse } from "next/server"
import { format } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"
import { isValidWorkType } from "@/lib/work-types"
import {
  checkSlotAvailability,
  isWithinChangeWindow,
  hasStarted,
  toBookingDate,
  BOOKING_CHANGE_CUTOFF_MINUTES,
} from "@/lib/booking-rules"

const BOOKING_INCLUDE = {
  faculty: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
  pa: { select: { id: true, name: true, username: true, email: true, phoneNumber: true, photoUrl: true } },
  department: { select: { id: true, name: true } },
} as const

function slotLabel(start: Date, end: Date) {
  return `${format(start, "h:mm a")}–${format(end, "h:mm a")}`
}

function dayLabel(date: Date) {
  return date.toISOString().slice(0, 10)
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
          include: { actor: { select: { id: true, name: true, username: true } } },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }
    if (!canView(sessionUser.role, sessionUser.id, booking)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      booking,
      rules: {
        cutoffMinutes: BOOKING_CHANGE_CUTOFF_MINUTES,
        // Computed server-side so the client can't fake an open window
        canChange: booking.status === "BOOKED" && isWithinChangeWindow(booking.startTime),
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
// within BOOKING_CHANGE_CUTOFF_MINUTES of the start time.
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

  // Only the booking's faculty or an admin may change it
  const isOwnerFaculty = sessionUser.role === "FACULTY" && booking.facultyId === sessionUser.id
  if (sessionUser.role !== "ADMIN" && !isOwnerFaculty) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const actorName = sessionUser.email ?? "Faculty"
    const rawRemark = typeof body.remark === "string" ? body.remark.trim() : ""
    const remark = rawRemark ? rawRemark.slice(0, 1000) : null

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
      if (!isWithinChangeWindow(booking.startTime)) {
        return NextResponse.json(
          {
            error: `Bookings can only be rescheduled more than ${BOOKING_CHANGE_CUTOFF_MINUTES} minutes before the start time`,
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

      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Booking rescheduled",
        message: `Your booking moved from ${previous} to ${next}.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })

      return NextResponse.json({ booking: updated })
    }

    // ------------------------------------------------------------------- status
    const status = body.status as "COMPLETED" | "ABSENT" | "CANCELLED"
    if (!["COMPLETED", "ABSENT", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    if (booking.status !== "BOOKED") {
      return NextResponse.json(
        { error: `This booking is already ${booking.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    // Completed / absent can only be recorded once the slot has begun
    if ((status === "COMPLETED" || status === "ABSENT") && !hasStarted(booking.startTime)) {
      return NextResponse.json(
        { error: "You can only record the outcome once the booking's start time has passed" },
        { status: 409 }
      )
    }

    if (status === "CANCELLED" && !isWithinChangeWindow(booking.startTime)) {
      return NextResponse.json(
        {
          error: `Bookings can only be cancelled more than ${BOOKING_CHANGE_CUTOFF_MINUTES} minutes before the start time`,
        },
        { status: 409 }
      )
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

    const logAction =
      status === "CANCELLED" ? "CANCELLED" : status === "COMPLETED" ? "COMPLETED" : "MARKED_ABSENT"
    const logMessage =
      status === "CANCELLED"
        ? `Cancelled ${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)}`
        : status === "COMPLETED"
          ? `Marked as completed${ratingOnComplete != null ? ` · rated ${ratingOnComplete}/5` : ""}`
          : "PA marked absent for this slot"

    await prisma.bookingLog.create({
      data: { bookingId: id, action: logAction, actorId: sessionUser.id, message: logMessage, remark },
    })

    if (status === "ABSENT") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Marked absent",
        message: `You were marked absent for a booked slot.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })
    } else if (status === "CANCELLED") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Booking cancelled",
        message: `${actorName} cancelled your ${dayLabel(booking.date)} ${slotLabel(booking.startTime, booking.endTime)} slot.${remark ? ` Note: ${remark}` : ""}`,
        refId: id,
      })
    }

    return NextResponse.json({ booking: updated })
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 })
  }
}
