import { NextResponse } from "next/server"
import { endOfDay, format, startOfDay } from "date-fns"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

const DEFAULT_PAGE_SIZE = 15
const MAX_PAGE_SIZE = 100

// GET: Project Assistant attendance across the organization, for the Admin
// Attendance page.
// Query: ?date=YYYY-MM-DD | ?month=1..12&year=YYYY, ?departmentId=, ?status=,
//        ?q= (name/email), ?page=&limit=
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get("date")
  const monthParam = searchParams.get("month") ?? "all"
  const yearParam = searchParams.get("year") ?? "all"
  const departmentId = searchParams.get("departmentId")
  const statusFilter = searchParams.get("status") ?? "all"
  const q = (searchParams.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )

  // Punch window — a single date wins over month/year when both are supplied
  let checkInFilter: Prisma.DateTimeFilter | undefined
  if (dateParam) {
    const d = new Date(`${dateParam}T00:00:00`)
    if (!isNaN(d.getTime())) checkInFilter = { gte: startOfDay(d), lte: endOfDay(d) }
  } else if (yearParam !== "all") {
    const year = Number(yearParam)
    if (monthParam !== "all") {
      const month = Number(monthParam)
      checkInFilter = {
        gte: new Date(year, month - 1, 1),
        lte: endOfDay(new Date(year, month, 0)),
      }
    } else {
      checkInFilter = { gte: new Date(year, 0, 1), lte: endOfDay(new Date(year, 11, 31)) }
    }
  }

  const where: Prisma.AttendanceWhereInput = {
    user: {
      role: "PROJECT_ASSISTANT",
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    ...(departmentId && departmentId !== "all" ? { departmentId } : {}),
    ...(checkInFilter ? { checkInTime: checkInFilter } : {}),
  }

  const [total, records, departments] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      orderBy: { checkInTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        checkInTime: true,
        checkOutTime: true,
        checkInLatitude: true,
        checkInLongitude: true,
        flaggedOutsideGeofence: true,
        departmentId: true,
        user: { select: { id: true, name: true, username: true, email: true, photoUrl: true } },
        department: { select: { id: true, name: true, shiftStartTime: true, lateGraceMinutes: true } },
      },
    }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])

  const mapped = records.map((r) => {
    const [h, m] = r.department.shiftStartTime.split(":").map(Number)
    const lateAfter = h * 60 + m + r.department.lateGraceMinutes
    const minutesIn = r.checkInTime.getHours() * 60 + r.checkInTime.getMinutes()
    return {
      id: r.id,
      date: format(r.checkInTime, "yyyy-MM-dd"),
      checkInAt: format(r.checkInTime, "HH:mm"),
      checkOutAt: r.checkOutTime ? format(r.checkOutTime, "HH:mm") : null,
      status: (minutesIn > lateAfter ? "LATE" : "ON_TIME") as "LATE" | "ON_TIME",
      flaggedOutsideGeofence: r.flaggedOutsideGeofence,
      hasLocation: r.checkInLatitude != null && r.checkInLongitude != null,
      user: r.user,
      department: { id: r.department.id, name: r.department.name },
    }
  })

  // Status is derived per-record, so it filters after mapping
  const filtered =
    statusFilter === "on-time"
      ? mapped.filter((r) => r.status === "ON_TIME")
      : statusFilter === "late"
        ? mapped.filter((r) => r.status === "LATE")
        : mapped

  return NextResponse.json({
    records: filtered,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    departments,
  })
}
