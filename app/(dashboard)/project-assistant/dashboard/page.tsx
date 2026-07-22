"use client"

import { useEffect, useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns"
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Fingerprint,
  LogIn,
  LogOut,
  PartyPopper,
  Plane,
  Timer,
  Users,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Mock data — swap for real API calls
// ---------------------------------------------------------------------------

const TODAY_ATTENDANCE = {
  checkedInAt: "09:04 AM",
  checkedOutAt: null as string | null, // null = still checked in
  durationSoFar: "4h 32m",
  status: "On time" as "On time" | "Late" | "Absent",
}

const PENDING_LEAVES = 2
const TEAM_MEMBERS = 24
const MONTHLY_SALARY = 85000

const UPCOMING_LEAVES = [
  { id: "1", type: "Annual leave", dates: "Jul 21 – Jul 23", days: 3, status: "APPROVED" as const },
  { id: "2", type: "Casual leave", dates: "Aug 4", days: 1, status: "PENDING" as const },
  { id: "3", type: "Sick leave", dates: "Aug 18 – Aug 19", days: 2, status: "PENDING" as const },
]

type HolidaySummary = {
  id: string
  name: string
  date: string
  type: "NATIONAL" | "RELIGIOUS" | "CUSTOM"
}

type AttendanceSummary = {
  checkedInAt: string | null
  checkedOutAt: string | null
  durationSoFar: string
  isOpen: boolean
  status: string
} | null

type LeaveSummary = {
  usedLeaveDays: number
  pendingLeaves: number
} | null

type UpcomingLeaveSummary = {
  id: string
  type: string
  startDate: string
  endDate: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

type DepartmentSummary = {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  shiftStartTime: string
  shiftEndTime: string
  workingDays: string
  holidays: HolidaySummary[]
}

// Attendance map for the calendar. Key: yyyy-MM-dd
// In a real app, fetch this per visible month.
type DayStatus = "PRESENT" | "LATE" | "ABSENT" | "LEAVE"

const ATTENDANCE_RECORDS: Record<string, DayStatus> = {
  "2026-07-01": "PRESENT",
  "2026-07-02": "PRESENT",
  "2026-07-03": "LATE",
  "2026-07-06": "PRESENT",
  "2026-07-07": "PRESENT",
  "2026-07-08": "ABSENT",
  "2026-07-09": "PRESENT",
}

const HOLIDAYS: Record<string, string> = {
  "2026-07-17": "Founders' Day",
  "2026-07-31": "Company Offsite",
  "2026-08-15": "Independence Day",
}

const LEAVE_DATES: string[] = ["2026-07-21", "2026-07-22", "2026-07-23"]

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

function getDayMeta(date: Date, holidayLookup: Record<string, HolidaySummary>) {
  const key = dayKey(date)
  const holiday = holidayLookup[key]
  if (holiday) return { kind: "HOLIDAY" as const, label: holiday.name }
  if (LEAVE_DATES.includes(key)) return { kind: "LEAVE" as const, label: "On leave" }
  const att = ATTENDANCE_RECORDS[key]
  if (att) return { kind: att, label: att.charAt(0) + att.slice(1).toLowerCase() }
  return null
}

const DOT_STYLES: Record<string, string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-500",
  ABSENT: "bg-red-500",
  LEAVE: "bg-violet-500",
  HOLIDAY: "bg-indigo-500",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UserDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [department, setDepartment] = useState<DepartmentSummary | null>(null)
  const [attendance, setAttendance] = useState<AttendanceSummary>(null)
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>(null)
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeaveSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    // getDay: 0 = Sunday. We render Mon-first, so shift.
    const leadingBlanks = (getDay(start) + 6) % 7
    return { days, leadingBlanks }
  }, [month])

  const holidayLookup = useMemo(() => {
    return (department?.holidays || []).reduce<Record<string, HolidaySummary>>((acc, holiday) => {
      acc[dayKey(new Date(holiday.date))] = holiday
      return acc
    }, {})
  }, [department])

  const selectedMeta = selectedDay ? getDayMeta(selectedDay, holidayLookup) : null
  const isCheckedIn = !!attendance?.checkedInAt && !attendance?.checkedOutAt && attendance.isOpen

  const monthHolidays = useMemo(
    () =>
      (department?.holidays || [])
        .filter((holiday) => isSameMonth(new Date(holiday.date), month))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [month, department]
  )

  const leaveUsed = leaveSummary?.usedLeaveDays ?? 0
  const pendingLeaves = leaveSummary?.pendingLeaves ?? 0

  useEffect(() => {
    if (sessionStatus === "loading") {
      return
    }

    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      try {
        const [departmentResponse, attendanceResponse, leavesResponse] = await Promise.all([
          fetch("/api/departments/me"),
          fetch("/api/attendance/today"),
          fetch("/api/leaves"),
        ])

        const departmentData = await departmentResponse.json()
        const attendanceData = await attendanceResponse.json()
        const leavesData = await leavesResponse.json()

        if (!active) {
          return
        }

        if (departmentResponse.ok && departmentData?.department) {
          setDepartment(departmentData.department)
        }

        if (attendanceResponse.ok) {
          setAttendance(attendanceData.attendance)
        }

        if (leavesResponse.ok) {
          setLeaveSummary(leavesData.summary)
          setUpcomingLeaves(leavesData.upcomingLeaves || [])
        }
      } catch (loadError) {
        console.error("Failed to load dashboard data:", loadError)
        if (active) {
          setError("Unable to load dashboard data right now.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [sessionStatus])

  async function refreshAttendance() {
    const response = await fetch("/api/attendance/today")
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error || "Failed to refresh attendance")
    }
    setAttendance(data.attendance)
  }

  async function handlePunch() {
    if (!navigator.geolocation) {
      setError("Geolocation is required to punch attendance.")
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })

      const endpoint = isCheckedIn ? "/api/attendance/check-out" : "/api/attendance/check-in"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update attendance")
      }

      await refreshAttendance()
    } catch (punchError) {
      setError(punchError instanceof Error ? punchError.message : "Unable to update attendance")
    } finally {
      setActionLoading(false)
    }
  }

  const displayName = session?.user?.name ?? "there"
  const departmentName = department?.name ?? "your department"

  return (
    <TooltipProvider delay={0}>
      <div>
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Good afternoon, {displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {format(new Date(), "EEEE, MMMM d, yyyy")} · {departmentName}
            </p>
          </div>
          <div className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {loading ? "Loading dashboard…" : `${department?.workingDays || "Mon-Fri"}`}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Attendance / check-in card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Fingerprint className="h-5 w-5" />
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                  isCheckedIn && "bg-emerald-50 text-emerald-600",
                  !isCheckedIn && "bg-slate-100 text-slate-500"
                )}
              >
                {attendance?.status || (isCheckedIn ? "Checked in" : "Not checked in")}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">Today&apos;s Attendance</p>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <LogIn className="h-3.5 w-3.5" /> Checked in
                </span>
                <span className="font-semibold text-slate-900">{attendance?.checkedInAt ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <LogOut className="h-3.5 w-3.5" /> Checked out
                </span>
                <span className="font-semibold text-slate-900">
                  {attendance?.checkedOutAt ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Timer className="h-3.5 w-3.5" /> Duration
                </span>
                <span className="font-semibold text-indigo-600">
                  {attendance?.durationSoFar ?? "0m"}
                  {isCheckedIn && <span className="text-xs font-normal text-slate-400"> · ongoing</span>}
                </span>
              </div>
            </div>
            <Button
              onClick={handlePunch}
              disabled={actionLoading}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-5 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 cursor-pointer"
            >
              {isCheckedIn ? (
                <>
                  <LogOut className="mr-1.5 h-4 w-4" />
                  {actionLoading ? "Checking out…" : "Check out"}
                </>
              ) : (
                <>
                  <LogIn className="mr-1.5 h-4 w-4" />
                  {actionLoading ? "Checking in…" : "Check in"}
                </>
              )}
            </Button>
          </div>

          {/* Leave balance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Clock className="h-5 w-5" />
              </span>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-600">
                {pendingLeaves} pending
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{leaveUsed} days</p>
            <p className="text-sm text-slate-500">Leave Taken This Year</p>
            <p className="mt-4 text-xs text-slate-400">
              Leave is unlimited — this tracks approved days taken, not a quota.
            </p>
          </div>

          {/* Department snapshot */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-indigo-50 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">Department</p>
                <p className="truncate text-xs text-slate-400">Shift schedule and working days</p>
              </div>
            </div>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{departmentName}</p>
            <div className="mt-4 space-y-2 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Shift</span>
                <span>{department?.shiftStartTime ?? "—"} – {department?.shiftEndTime ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Working days</span>
                <span>{department?.workingDays ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar + upcoming leaves */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">My Attendance Calendar</h2>
                <p className="text-sm text-slate-500">Attendance, leaves and department holidays.</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-32 text-center text-sm font-semibold text-slate-900">
                  {format(month, "MMMM yyyy")}
                </span>
                <button
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="mt-5 grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {d}
                </div>
              ))}

              {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {calendarDays.days.map((day) => {
                const meta = getDayMeta(day, holidayLookup)
                const selected = selectedDay && isSameDay(day, selectedDay)
                const content = (
                  <button
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-xl text-sm transition-colors",
                      selected
                        ? "bg-indigo-600 font-semibold text-white"
                        : isToday(day)
                          ? "bg-indigo-50 font-semibold text-indigo-600"
                          : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    {format(day, "d")}
                    {meta && (
                      <span
                        className={cn(
                          "absolute bottom-1.5 h-1.5 w-1.5 rounded-full",
                          selected ? "bg-white" : DOT_STYLES[meta.kind]
                        )}
                      />
                    )}
                  </button>
                )
                return (
                  meta ? (
                    <Tooltip key={day.toISOString()}>
                      <TooltipTrigger render={content} />
                      <TooltipContent side="top" align="center">
                        <div className="space-y-0.5 text-left">
                          <p className="font-semibold">{meta.label}</p>
                          <p className="text-[11px] opacity-80">{format(day, "EEE, MMM d")}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={day.toISOString()}>{content}</div>
                  )
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-4">
              {(
                [
                  { label: "Present", cls: "bg-emerald-500" },
                  { label: "Late", cls: "bg-amber-500" },
                  { label: "Absent", cls: "bg-red-500" },
                  { label: "On leave", cls: "bg-violet-500" },
                  { label: "Holiday", cls: "bg-indigo-500" },
                ] as const
              ).map(({ label, cls }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={cn("h-2 w-2 rounded-full", cls)} /> {label}
                </span>
              ))}
            </div>

            {/* Selected day detail */}
            {selectedDay && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {format(selectedDay, "EEE, MMM d")}:
                  </span>{" "}
                  {selectedMeta ? selectedMeta.label : "No record"}
                </p>
              </div>
            )}
          </div>

          {/* Right column: upcoming leaves + this month's holidays */}
          <div className="space-y-4">
            {/* Upcoming leaves */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Upcoming Leaves</h2>
                <Plane className="h-4 w-4 text-indigo-600" />
              </div>

              <div className="mt-4 space-y-3">
                {upcomingLeaves.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">No upcoming leaves.</p>
                )}
                {upcomingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{leave.type}</p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(leave.startDate), "MMM d")} – {format(new Date(leave.endDate), "MMM d")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        leave.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600"
                      )}
                    >
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>

              <button className="mt-4 w-full text-center text-sm font-medium text-indigo-600 hover:underline">
                Request a leave
              </button>
            </div>

            {/* Holidays this month */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Holidays · {format(month, "MMM")}
                </h2>
                <PartyPopper className="h-4 w-4 text-indigo-600" />
              </div>

              <div className="mt-4 space-y-2.5">
                {monthHolidays.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-400">
                    No holidays this month.
                  </p>
                )}
                {monthHolidays.map((holiday) => (
                  <Tooltip key={holiday.id}>
                    <TooltipTrigger
                      render={
                        <div className="flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-slate-50">
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 leading-none">
                            <span className="text-sm font-bold text-indigo-600">
                              {format(new Date(holiday.date), "d")}
                            </span>
                            <span className="text-[9px] font-medium uppercase text-indigo-400">
                              {format(new Date(holiday.date), "EEE")}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{holiday.name}</p>
                            <p className="text-xs text-slate-400">{format(new Date(holiday.date), "MMMM d")}</p>
                          </div>
                          <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-indigo-200" />
                        </div>
                      }
                    />
                    <TooltipContent side="left" align="start">
                      <div className="space-y-0.5 text-left">
                        <p className="font-semibold">{holiday.name}</p>
                        <p className="text-[11px] opacity-80">{format(new Date(holiday.date), "EEEE, MMM d")}</p>
                        <p className="text-[11px] opacity-80">{holiday.type.toLowerCase()} holiday</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}