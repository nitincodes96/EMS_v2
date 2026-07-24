"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isToday,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns"
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Fingerprint,
  LogIn,
  LogOut,
  MapPin,
  Plane,
  Timer,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EntityAvatar } from "@/components/shared/entity-avatar"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HolidaySummary = { id: string; name: string; date: string; type: string }

type AttendanceSummary = {
  checkedInAt: string | null
  checkedOutAt: string | null
  durationSoFar: string
  isOpen: boolean
  status: string
} | null

type AttendanceRecord = {
  id: string
  date: string
  checkInTime: string
  checkOutTime: string | null
  status: "PRESENT" | "LATE"
}

type UpcomingLeave = {
  id: string
  type: string
  startDate: string
  endDate: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

type Leave = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

type DepartmentSummary = {
  id: string
  name: string
  shiftStartTime: string
  shiftEndTime: string
  workingDays: string
  holidays: HolidaySummary[]
}

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  faculty: { id: string; name: string | null; username: string; photoUrl: string | null }
  department: { id: string; name: string } | null
}

type DayKind = "PRESENT" | "LATE" | "ABSENT" | "LEAVE" | "HOLIDAY"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

const DOT_STYLES: Record<DayKind, string> = {
  PRESENT: "bg-emerald-500",
  LATE: "bg-amber-500",
  ABSENT: "bg-red-500",
  LEAVE: "bg-violet-500",
  HOLIDAY: "bg-indigo-500",
}

function greeting(now: Date) {
  const h = now.getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UserDashboard() {
  const { data: session } = useSession()
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())

  const [department, setDepartment] = useState<DepartmentSummary | null>(null)
  const [attendance, setAttendance] = useState<AttendanceSummary>(null)
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeave[]>([])
  const [leaveSummary, setLeaveSummary] = useState<{ usedLeaveDays: number; pendingLeaves: number }>({
    usedLeaveDays: 0,
    pendingLeaves: 0,
  })
  const [bookings, setBookings] = useState<Booking[]>([])

  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthParam = format(month, "yyyy-MM")

  /** Everything that isn't month-scoped. */
  const loadCore = useCallback(async () => {
    try {
      const [deptRes, attRes, leavesRes, bookingsRes] = await Promise.all([
        fetch("/api/departments/me"),
        fetch("/api/attendance/today"),
        fetch("/api/leaves"),
        fetch("/api/bookings"),
      ])

      if (deptRes.ok) {
        const d = await deptRes.json()
        setDepartment(d.department ?? null)
      }
      if (attRes.ok) {
        const d = await attRes.json()
        setAttendance(d.attendance ?? null)
      }
      if (leavesRes.ok) {
        const d = await leavesRes.json()
        setLeaves(d.leaves ?? [])
        setUpcomingLeaves(d.upcomingLeaves ?? [])
        setLeaveSummary(d.summary ?? { usedLeaveDays: 0, pendingLeaves: 0 })
      }
      if (bookingsRes.ok) {
        const d = await bookingsRes.json()
        setBookings(d.bookings ?? [])
      }
    } catch {
      setError("Could not load your dashboard data.")
    }
  }, [])

  const loadMonth = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance?month=${monthParam}`)
      if (res.ok) {
        const d = await res.json()
        setMonthRecords(d.records ?? [])
      }
    } catch {
      // calendar simply renders without dots
    }
  }, [monthParam])

  useEffect(() => {
    void loadCore()
  }, [loadCore])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  // ---------------------------------------------------------------- derived

  const isCheckedIn = Boolean(attendance?.checkedInAt && !attendance?.checkedOutAt && attendance?.isOpen)

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return {
      days: eachDayOfInterval({ start, end }),
      leadingBlanks: (getDay(start) + 6) % 7, // grid starts on Monday
    }
  }, [month])

  const holidayLookup = useMemo(
    () =>
      (department?.holidays ?? []).reduce<Record<string, HolidaySummary>>((acc, h) => {
        acc[dayKey(new Date(h.date))] = h
        return acc
      }, {}),
    [department]
  )

  const leaveLookup = useMemo(() => {
    const set = new Set<string>()
    for (const l of leaves) {
      if (l.status === "REJECTED") continue
      for (const d of eachDayOfInterval({ start: new Date(l.startDate), end: new Date(l.endDate) })) {
        set.add(dayKey(d))
      }
    }
    return set
  }, [leaves])

  const attendanceLookup = useMemo(
    () =>
      monthRecords.reduce<Record<string, AttendanceRecord>>((acc, r) => {
        acc[r.date] = r
        return acc
      }, {}),
    [monthRecords]
  )

  const workingDays = useMemo(
    () => new Set((department?.workingDays ?? "Mon,Tue,Wed,Thu,Fri").split(",").map((d) => d.trim())),
    [department]
  )

  /** Resolve what a calendar day represents, in priority order. */
  const getDayMeta = useCallback(
    (date: Date): { kind: DayKind; label: string } | null => {
      const key = dayKey(date)
      const holiday = holidayLookup[key]
      if (holiday) return { kind: "HOLIDAY", label: holiday.name }
      if (leaveLookup.has(key)) return { kind: "LEAVE", label: "On leave" }

      const record = attendanceLookup[key]
      if (record) {
        return {
          kind: record.status,
          label: record.status === "LATE" ? "Late check-in" : "Present",
        }
      }

      // Only call a past working day absent — future days are simply unknown
      const isPastWorkingDay =
        isBefore(startOfDay(date), startOfDay(new Date())) && workingDays.has(format(date, "EEE"))
      if (isPastWorkingDay) return { kind: "ABSENT", label: "Absent" }

      return null
    },
    [holidayLookup, leaveLookup, attendanceLookup, workingDays]
  )

  const selectedMeta = selectedDay ? getDayMeta(selectedDay) : null

  // Active booking right now, else the next one still to come today
  const now = new Date()
  const activeBooking = useMemo(() => {
    const live = bookings.find(
      (b) => b.status === "BOOKED" && new Date(b.startTime) <= now && new Date(b.endTime) >= now
    )
    if (live) return { booking: live, live: true }
    const next = bookings
      .filter((b) => b.status === "BOOKED" && new Date(b.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    return next ? { booking: next, live: false } : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings])

  const tasksInQueue = useMemo(
    () => bookings.filter((b) => b.status === "BOOKED" && new Date(b.endTime) >= now).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings]
  )

  // ----------------------------------------------------------------- punch

  async function handlePunch() {
    if (!navigator.geolocation) {
      setError("Geolocation is required to punch attendance.")
      return
    }

    setActionLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const endpoint = isCheckedIn ? "/api/attendance/check-out" : "/api/attendance/check-in"
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) throw new Error(data?.error || "Unable to update attendance")

          await Promise.all([loadCore(), loadMonth()])
        } catch (punchError) {
          setError(punchError instanceof Error ? punchError.message : "Unable to update attendance")
        } finally {
          setActionLoading(false)
        }
      },
      () => {
        setError("Location permission is required to punch attendance.")
        setActionLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const displayName = session?.user?.name ?? "there"
  const departmentName = department?.name ?? "—"

  return (
    <TooltipProvider delay={0}>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {greeting(now)}, {displayName}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {format(now, "EEEE, MMMM d, yyyy")}
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-700">{departmentName}</span>
            </p>
          </div>

          {isCheckedIn && (
            <div className="flex h-max items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Available for Booking
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Top Row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Punch card */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <Fingerprint className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Today&apos;s Attendance</h2>
                {isCheckedIn ? (
                  <div className="mt-0.5 flex w-max items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                    <MapPin className="h-3 w-3" /> Location verified
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    {attendance?.checkedOutAt ? "Shift completed" : "Awaiting check-in"}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-5 flex-1 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <LogIn className="h-4 w-4 text-slate-400" /> Checked in
                </span>
                <span className="font-semibold text-slate-900">{attendance?.checkedInAt ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <LogOut className="h-4 w-4 text-slate-400" /> Checked out
                </span>
                <span className="font-semibold text-slate-900">{attendance?.checkedOutAt ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <Timer className="h-4 w-4 text-slate-400" /> Duration
                </span>
                <span className="font-semibold text-indigo-600">{attendance?.durationSoFar ?? "0m"}</span>
              </div>
            </div>

            <Button
              onClick={handlePunch}
              disabled={actionLoading || Boolean(attendance?.checkedOutAt)}
              className="w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-6 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {attendance?.checkedOutAt ? (
                <>
                  <LogOut className="mr-2 h-5 w-5" /> Shift completed
                </>
              ) : isCheckedIn ? (
                <>
                  <LogOut className="mr-2 h-5 w-5" />
                  {actionLoading ? "Processing…" : "Punch Out"}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  {actionLoading ? "Processing…" : "Punch In"}
                </>
              )}
            </Button>
          </div>

          {/* Current assignment */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Briefcase className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Current Assignment</h2>
                <p className="text-xs text-slate-500">Booked by faculty</p>
              </div>
            </div>

            {activeBooking ? (
              <div className="flex flex-1 flex-col rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      activeBooking.live ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {activeBooking.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />}
                    {activeBooking.live ? "In progress" : "Up next"}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {format(new Date(activeBooking.booking.startTime), "h:mm a")} –{" "}
                    {format(new Date(activeBooking.booking.endTime), "h:mm a")}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900">
                  {activeBooking.booking.workType ?? "Assigned task"}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{activeBooking.booking.task}</p>
                {!activeBooking.live && (
                  <p className="mt-2 text-[11px] font-medium text-slate-400">
                    {format(new Date(activeBooking.booking.date), "EEE, MMM d")}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-3 border-t border-slate-200/60 pt-3">
                  <EntityAvatar
                    name={activeBooking.booking.faculty.name || activeBooking.booking.faculty.username}
                    fallbackText={activeBooking.booking.faculty.name || activeBooking.booking.faculty.username}
                    imageUrl={activeBooking.booking.faculty.photoUrl}
                    size="sm"
                    className="h-8 w-8"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {activeBooking.booking.faculty.name || activeBooking.booking.faculty.username}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {activeBooking.booking.department?.name ?? "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : isCheckedIn ? (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <Briefcase className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-900">Standby mode</p>
                <p className="mt-1 max-w-55 text-xs text-slate-500">
                  You&apos;re available for faculty bookings between {department?.shiftStartTime ?? "09:00"} and{" "}
                  {department?.shiftEndTime ?? "18:00"}.
                </p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center opacity-75">
                <LogIn className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-900">Offline</p>
                <p className="mt-1 text-xs text-slate-500">Punch in to become bookable by faculty.</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-4">
            <Link
              href="/project-assistant/tasks"
              className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{tasksInQueue}</p>
                <p className="text-sm font-medium text-slate-500">Tasks in queue</p>
              </div>
            </Link>

            <div className="flex flex-1 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <Plane className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {leaveSummary.usedLeaveDays} <span className="text-sm font-medium text-slate-500">days</span>
                  </p>
                  {leaveSummary.pendingLeaves > 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {leaveSummary.pendingLeaves} pending
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-500">Leave taken this year</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Attendance calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Attendance Calendar</h2>
                <p className="text-sm text-slate-500">Track your daily punches and absences.</p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200">
                <button
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:shadow-sm"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-28 text-center text-sm font-bold text-slate-900">
                  {format(month, "MMMM yyyy")}
                </span>
                <button
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:shadow-sm"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-x-1 gap-y-2 text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {d}
                </div>
              ))}

              {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}

              {calendarDays.days.map((day) => {
                const meta = getDayMeta(day)
                const selected = selectedDay && isSameDay(day, selectedDay)
                const content = (
                  <button
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "relative mx-auto flex h-10 w-10 cursor-pointer flex-col items-center justify-center rounded-xl text-sm transition-all duration-200",
                      selected
                        ? "bg-indigo-600 font-bold text-white shadow-md shadow-indigo-200"
                        : isToday(day)
                          ? "bg-indigo-50 font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                          : "font-medium text-slate-700 hover:bg-slate-100"
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

                return meta ? (
                  <Tooltip key={day.toISOString()}>
                    <TooltipTrigger>
                      <div>{content}</div>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="border-none bg-slate-900 text-white shadow-lg">
                      <div className="space-y-0.5 px-1 py-0.5 text-left">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="text-[11px] text-slate-300">{format(day, "EEE, MMM d")}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={day.toISOString()}>{content}</div>
                )
              })}
            </div>

            {/* Legend & selected detail */}
            <div className="mt-6 flex flex-col justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {(
                  [
                    { label: "Present", cls: "bg-emerald-500" },
                    { label: "Late", cls: "bg-amber-500" },
                    { label: "Absent", cls: "bg-red-500" },
                    { label: "Leave", cls: "bg-violet-500" },
                    { label: "Holiday", cls: "bg-indigo-500" },
                  ] as const
                ).map(({ label, cls }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <span className={cn("h-2.5 w-2.5 rounded-full", cls)} /> {label}
                  </span>
                ))}
              </div>

              {selectedDay && (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm ring-1 ring-slate-200">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold text-slate-900">{format(selectedDay, "MMM d")}:</span>
                  <span className="text-slate-600">{selectedMeta ? selectedMeta.label : "No record"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming leaves */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Upcoming Leaves</h2>
              <Plane className="h-4 w-4 text-indigo-600" />
            </div>

            <div className="space-y-3">
              {upcomingLeaves.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No upcoming leaves.</p>
              ) : (
                upcomingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{leave.type}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {format(new Date(leave.startDate), "MMM d")} – {format(new Date(leave.endDate), "MMM d")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        leave.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {leave.status}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="ghost"
              render={<Link href="/project-assistant/leave" />}
              className="mt-4 w-full cursor-pointer text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Request time off
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
