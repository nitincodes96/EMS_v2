import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { toBookingDate } from "@/lib/booking-rules"
import { noticeWindow, windowBlocksRange } from "@/lib/unavailability"
import { parseHHMM } from "@/lib/booking-slots"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// GET: directory of active Project Assistants a faculty can book.
//  - FACULTY: PAs in their own department
//  - ADMIN: PAs across all departments (optionally ?departmentId=)
// Unlike /api/availability (live punched-in only), this returns the full
// bookable roster so slots can be scheduled for any chosen day.
//
// Optional availability filter:
//   ?date=YYYY-MM-DD                → each PA gets an availability status for
//                                     that day (free / booked / on-leave / unavailable)
//   &startTime=HH:mm&endTime=HH:mm  → status reflects that exact slot instead
//                                     of the whole day
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (sessionUser.role === "FACULTY" && !sessionUser.departmentId) {
    return NextResponse.json({ pas: [] })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")

  const departmentFilter =
    sessionUser.role === "FACULTY"
      ? { departmentId: sessionUser.departmentId }
      : departmentIdParam && departmentIdParam !== "all"
        ? { departmentId: departmentIdParam }
        : {}

  const pas = await prisma.user.findMany({
    where: {
      role: "PROJECT_ASSISTANT",
      isActive: true,
      // Only PAs who accepted their invite — an INVITED account has no password
      // set yet and can't actually turn up for a slot.
      status: "ACCEPTED",
      ...departmentFilter,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      photoUrl: true,
      isAvailable: true,
      availabilitySince: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ isAvailable: "desc" }, { name: "asc" }],
  })

  // ---- Optional availability filter for a specific date / slot ----
  const dateParam = searchParams.get("date")
  const startTimeParam = searchParams.get("startTime")
  const endTimeParam = searchParams.get("endTime")

  const dateValid = dateParam ? /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !isNaN(new Date(dateParam).getTime()) : false

  if (!dateValid) {
    return NextResponse.json({ pas })
  }

  const bookingDate = toBookingDate(dateParam!)
  const hasSlot = HHMM.test(startTimeParam ?? "") && HHMM.test(endTimeParam ?? "")
  const slotStart = hasSlot ? new Date(`${dateParam}T${startTimeParam}`) : null
  const slotEnd = hasSlot ? new Date(`${dateParam}T${endTimeParam}`) : null
  const slotOk = slotStart && slotEnd && slotEnd > slotStart

  const paIds = pas.map((p) => p.id)

  const [leaves, notices, bookings] = await Promise.all([
    prisma.leave.findMany({
      where: {
        userId: { in: paIds },
        status: "APPROVED",
        startDate: { lte: bookingDate },
        endDate: { gte: bookingDate },
      },
      select: { userId: true },
    }),
    prisma.unavailabilityNotice.findMany({
      where: { userId: { in: paIds }, date: bookingDate, status: "ACTIVE" },
      select: { id: true, userId: true, startTime: true, endTime: true, reason: true },
    }),
    prisma.booking.findMany({
      where: {
        paId: { in: paIds },
        date: bookingDate,
        status: { in: ["BOOKED", "COMPLETED"] },
      },
      select: { paId: true, startTime: true, endTime: true },
    }),
  ])

  const onLeaveSet = new Set(leaves.map((l) => l.userId))
  const noticesByPa = new Map<string, ReturnType<typeof noticeWindow>[]>()
  for (const n of notices) {
    const list = noticesByPa.get(n.userId) ?? []
    list.push(noticeWindow(n))
    noticesByPa.set(n.userId, list)
  }
  const bookingsByPa = new Map<string, { startTime: Date; endTime: Date }[]>()
  for (const b of bookings) {
    const list = bookingsByPa.get(b.paId) ?? []
    list.push({ startTime: b.startTime, endTime: b.endTime })
    bookingsByPa.set(b.paId, list)
  }

  const pasWithAvailability = pas.map((pa) => {
    const dayBookings = bookingsByPa.get(pa.id) ?? []
    const dayNotices = noticesByPa.get(pa.id) ?? []
    let status: "free" | "booked" | "on-leave" | "unavailable"

    if (onLeaveSet.has(pa.id)) {
      status = "on-leave"
    } else if (dayNotices.some((w) => w.wholeDay)) {
      // The PA said they won't be in at all that day
      status = "unavailable"
    } else if (hasSlot && slotOk) {
      // Unavailable if a notice covers the slot; busy if a booking overlaps it
      const away = dayNotices.some((w) =>
        windowBlocksRange(w, parseHHMM(startTimeParam!), parseHHMM(endTimeParam!))
      )
      const clash = dayBookings.some((b) => b.startTime < slotEnd! && b.endTime > slotStart!)
      status = away ? "unavailable" : clash ? "booked" : "free"
    } else {
      // Whole-day view: available unless fully unavailable (handled above)
      status = "free"
    }

    return {
      ...pa,
      availability: { status, dayBookingCount: dayBookings.length },
    }
  })

  return NextResponse.json({
    pas: pasWithAvailability,
    availabilityFor: { date: dateParam, startTime: hasSlot ? startTimeParam : null, endTime: hasSlot ? endTimeParam : null },
  })
}
