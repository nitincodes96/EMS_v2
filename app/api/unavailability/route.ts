import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { toBookingDate } from "@/lib/booking-rules"
import { logEvent } from "@/lib/system-log"
import { noticeDateLabel, noticeWindow, windowBlocksBooking, windowBlocksRange, windowLabel } from "@/lib/unavailability"
import { notifyOfUnavailability } from "@/lib/unavailability-notify"
import { parseHHMM } from "@/lib/booking-slots"

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_REASON = 500

const LIST_INCLUDE = {
  user: { select: { id: true, name: true, email: true, photoUrl: true } },
  department: { select: { id: true, name: true } },
} as const

// GET: unavailability notices.
//  - PROJECT_ASSISTANT: their own, newest date first
//  - ADMIN / MODERATOR: everyone's (optionally ?departmentId=, ?status=ACTIVE|WITHDRAWN)
// Pass ?upcoming=1 to keep only today and later.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status")
  const departmentIdParam = searchParams.get("departmentId")
  const upcoming = searchParams.get("upcoming") === "1"

  const scope: Prisma.UnavailabilityNoticeWhereInput =
    sessionUser.role === "PROJECT_ASSISTANT"
      ? { userId: sessionUser.id }
      : sessionUser.role === "ADMIN" || sessionUser.role === "MODERATOR"
        ? departmentIdParam && departmentIdParam !== "all"
          ? { departmentId: departmentIdParam }
          : {}
        : // Faculty only ever learn about notices through their bookings
          { id: "__none__" }

  const todayUtc = new Date()
  todayUtc.setUTCHours(0, 0, 0, 0)

  const notices = await prisma.unavailabilityNotice.findMany({
    where: {
      ...scope,
      ...(statusParam === "ACTIVE" || statusParam === "WITHDRAWN" ? { status: statusParam } : {}),
      ...(upcoming ? { date: { gte: todayUtc } } : {}),
    },
    include: LIST_INCLUDE,
    orderBy: upcoming ? [{ date: "asc" }, { startTime: "asc" }] : [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  })

  return NextResponse.json({ notices })
}

// POST: a Project Assistant gives notice that they won't be in. Takes effect
// immediately — there is no approval step. Body:
//   { date: "YYYY-MM-DD", wholeDay: boolean, startTime?: "HH:mm", endTime?: "HH:mm", reason?: string }
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "PROJECT_ASSISTANT") {
    return NextResponse.json({ error: "Only Project Assistants can give an unavailability notice" }, { status: 403 })
  }
  if (!sessionUser.departmentId) {
    return NextResponse.json({ error: "No department associated with this account" }, { status: 400 })
  }

  try {
    const body = (await request.json()) as {
      date?: string
      wholeDay?: boolean
      startTime?: string
      endTime?: string
      reason?: string
    }

    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "A valid date is required" }, { status: 400 })
    }
    const date = toBookingDate(body.date)
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 })
    }
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)
    if (date.getTime() < todayUtc.getTime()) {
      return NextResponse.json({ error: "You can't mark a past date" }, { status: 400 })
    }

    const wholeDay = body.wholeDay !== false
    let startTime: string | null = null
    let endTime: string | null = null
    if (!wholeDay) {
      startTime = (body.startTime ?? "").trim()
      endTime = (body.endTime ?? "").trim()
      if (!HHMM.test(startTime) || !HHMM.test(endTime)) {
        return NextResponse.json({ error: "Start and end times are required for a part-day notice" }, { status: 400 })
      }
      if (endTime <= startTime) {
        return NextResponse.json({ error: "End time must be after the start time" }, { status: 400 })
      }
    }

    const reason = (body.reason ?? "").trim().slice(0, MAX_REASON) || null

    // No stacking: one whole-day notice covers everything, and part-day
    // windows may not overlap an existing one.
    const existing = await prisma.unavailabilityNotice.findMany({
      where: { userId: sessionUser.id, date, status: "ACTIVE" },
    })
    const windows = existing.map(noticeWindow)
    if (windows.some((w) => w.wholeDay)) {
      return NextResponse.json({ error: "You've already marked that whole day as unavailable" }, { status: 409 })
    }
    if (!wholeDay) {
      const clash = windows.find((w) => windowBlocksRange(w, parseHHMM(startTime!), parseHHMM(endTime!)))
      if (clash) {
        return NextResponse.json(
          { error: `That overlaps a notice you already gave for ${windowLabel(clash)}` },
          { status: 409 }
        )
      }
    }

    const [pa, department] = await Promise.all([
      prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, name: true, email: true } }),
      prisma.department.findUnique({ where: { id: sessionUser.departmentId }, select: { name: true } }),
    ])
    if (!pa) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Open bookings that fall inside the window — their faculty get told.
    const dayBookings = await prisma.booking.findMany({
      where: { paId: sessionUser.id, date, status: "BOOKED" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        task: true,
        workType: true,
        faculty: { select: { id: true, name: true, email: true } },
      },
    })
    const pending = noticeWindow({ id: "", startTime, endTime, reason })
    const affected = dayBookings.filter((b) => windowBlocksBooking(pending, b.startTime, b.endTime))

    const notice = await prisma.unavailabilityNotice.create({
      data: {
        userId: sessionUser.id,
        departmentId: sessionUser.departmentId,
        date,
        startTime,
        endTime,
        reason,
        affectedBookings: affected.length,
      },
      include: LIST_INCLUDE,
    })

    const departmentName = department?.name ?? "Unknown department"
    const window = windowLabel(noticeWindow(notice))

    await logEvent({
      category: "UNAVAILABILITY",
      action: "Unavailability notice given",
      description: `${pa.name || pa.email} marked themselves unavailable on ${noticeDateLabel(date)} (${window})${
        affected.length > 0 ? ` — ${affected.length} booking${affected.length === 1 ? "" : "s"} affected` : ""
      }${reason ? ` — ${reason}` : ""}`,
      actor: sessionUser,
      entityType: "UnavailabilityNotice",
      entityId: notice.id,
      departmentId: sessionUser.departmentId,
    })

    await notifyOfUnavailability({ notice, pa, departmentName, affected })

    return NextResponse.json({ notice, affectedBookings: affected.length }, { status: 201 })
  } catch (error) {
    console.error("Error creating unavailability notice:", error)
    return NextResponse.json({ error: "Failed to save the notice" }, { status: 500 })
  }
}
