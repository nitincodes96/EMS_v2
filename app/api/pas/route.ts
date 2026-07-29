import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"
import { toBookingDate } from "@/lib/booking-rules"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// GET: directory of active Project Assistants a faculty can book.
//  - FACULTY: PAs in their own department
//  - ADMIN: PAs across all departments (optionally ?departmentId=)
// Unlike /api/availability (live punched-in only), this returns the full
// bookable roster so slots can be scheduled for any chosen day.
//
// Optional availability filter:
//   ?date=YYYY-MM-DD                → each PA gets an availability status for
//                                     that day (free / booked / on-leave)
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
      username: true,
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

  const [leaves, bookings] = await Promise.all([
    prisma.leave.findMany({
      where: {
        userId: { in: paIds },
        status: "APPROVED",
        startDate: { lte: bookingDate },
        endDate: { gte: bookingDate },
      },
      select: { userId: true },
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
  const bookingsByPa = new Map<string, { startTime: Date; endTime: Date }[]>()
  for (const b of bookings) {
    const list = bookingsByPa.get(b.paId) ?? []
    list.push({ startTime: b.startTime, endTime: b.endTime })
    bookingsByPa.set(b.paId, list)
  }

  const pasWithAvailability = pas.map((pa) => {
    const dayBookings = bookingsByPa.get(pa.id) ?? []
    let status: "free" | "booked" | "on-leave"

    if (onLeaveSet.has(pa.id)) {
      status = "on-leave"
    } else if (hasSlot && slotOk) {
      // Busy only if a booking overlaps the requested slot
      const clash = dayBookings.some((b) => b.startTime < slotEnd! && b.endTime > slotStart!)
      status = clash ? "booked" : "free"
    } else {
      // Whole-day view: available unless fully unavailable (on leave handled above)
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
