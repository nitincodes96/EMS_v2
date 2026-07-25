import { NextResponse } from "next/server"
import { eachDayOfInterval, format, isAfter, startOfDay, subDays } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: the signed-in user's own attendance history for the Attendance page.
// Query: ?month=1..12|all&year=YYYY|all  (both default to "all")
//
// Returns the user's geolocated check-in/out punches, plus synthesized ABSENT
// entries for past working days with no punch at all.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get("month") ?? "all"
  const yearParam = searchParams.get("year") ?? "all"

  const monthNum = monthParam === "all" ? null : Number(monthParam)
  const yearNum = yearParam === "all" ? null : Number(yearParam)
  if ((monthNum !== null && !(monthNum >= 1 && monthNum <= 12)) || (yearNum !== null && !Number.isFinite(yearNum))) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 })
  }

  /** Does a local calendar date fall inside the selected period? */
  const inPeriod = (d: Date) => {
    if (yearNum !== null && d.getFullYear() !== yearNum) return false
    if (monthNum !== null && d.getMonth() + 1 !== monthNum) return false
    return true
  }

  const [user, department, attendance, leaves] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { createdAt: true, joiningDate: true },
    }),
    prisma.department.findUnique({
      where: { id: sessionUser.departmentId },
      select: {
        shiftStartTime: true,
        lateGraceMinutes: true,
        workingDays: true,
        holidays: { select: { date: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { userId: sessionUser.id },
      orderBy: { checkInTime: "desc" },
      select: {
        id: true,
        checkInTime: true,
        checkOutTime: true,
        checkInLatitude: true,
        checkInLongitude: true,
        flaggedOutsideGeofence: true,
      },
    }),
    prisma.leave.findMany({
      where: { userId: sessionUser.id, status: "APPROVED" },
      select: { startDate: true, endDate: true },
    }),
  ])

  // Late once the punch passes shift start + the department's grace window
  const [shiftH, shiftM] = (department?.shiftStartTime ?? "09:00").split(":").map(Number)
  const lateAfterMinutes = shiftH * 60 + shiftM + (department?.lateGraceMinutes ?? 0)

  // ------------------------------------------------------------- punches
  type PunchEntry = {
    id: string
    date: string
    checkInAt: string | null
    checkOutAt: string | null
    location: { latitude: number; longitude: number; flagged: boolean } | null
    status: "ON_TIME" | "LATE" | "ABSENT"
  }

  const punches: PunchEntry[] = attendance
    .filter((a) => inPeriod(a.checkInTime))
    .map((a) => {
      const key = format(a.checkInTime, "yyyy-MM-dd")
      const minutesIn = a.checkInTime.getHours() * 60 + a.checkInTime.getMinutes()
      return {
        id: a.id,
        date: key,
        checkInAt: format(a.checkInTime, "HH:mm"),
        checkOutAt: a.checkOutTime ? format(a.checkOutTime, "HH:mm") : null,
        location:
          a.checkInLatitude != null && a.checkInLongitude != null
            ? {
                latitude: a.checkInLatitude,
                longitude: a.checkInLongitude,
                flagged: a.flaggedOutsideGeofence,
              }
            : null,
        status: minutesIn > lateAfterMinutes ? "LATE" : "ON_TIME",
      }
    })

  // Every day the user punched, regardless of period — used to skip absences
  const allPunchedDays = new Set(attendance.map((a) => format(a.checkInTime, "yyyy-MM-dd")))

  // -------------------------------------------------- synthesized absences
  const workingDays = new Set((department?.workingDays ?? "Mon,Tue,Wed,Thu,Fri").split(",").map((d) => d.trim()))

  const holidayKeys = new Set((department?.holidays ?? []).map((h) => format(h.date, "yyyy-MM-dd")))

  const leaveKeys = new Set<string>()
  for (const l of leaves) {
    for (const d of eachDayOfInterval({ start: l.startDate, end: l.endDate })) {
      leaveKeys.add(format(d, "yyyy-MM-dd"))
    }
  }

  // Never look further back than the account itself. Today is excluded — the
  // day isn't over, so a missing punch doesn't yet mean absent.
  const accountStart = startOfDay(user?.joiningDate ?? user?.createdAt ?? new Date())
  const lastAbsenceDay = subDays(startOfDay(new Date()), 1)

  const absences: PunchEntry[] = []
  if (!isAfter(accountStart, lastAbsenceDay)) {
    for (const day of eachDayOfInterval({ start: accountStart, end: lastAbsenceDay })) {
      const key = format(day, "yyyy-MM-dd")
      if (!inPeriod(day)) continue
      if (allPunchedDays.has(key)) continue
      if (!workingDays.has(format(day, "EEE"))) continue
      if (holidayKeys.has(key) || leaveKeys.has(key)) continue

      absences.push({
        id: `absent-${key}`,
        date: key,
        checkInAt: null,
        checkOutAt: null,
        location: null,
        status: "ABSENT",
      })
    }
  }

  const allPunches = [...punches, ...absences].sort((a, b) => b.date.localeCompare(a.date))

  return NextResponse.json({
    punches: allPunches,
    stats: {
      daysPresent: punches.length,
      lateDays: punches.filter((p) => p.status === "LATE").length,
      absentDays: absences.length,
    },
  })
}
