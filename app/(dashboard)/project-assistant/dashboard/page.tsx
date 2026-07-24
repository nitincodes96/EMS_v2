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
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  Fingerprint,
  LogIn,
  LogOut,
  MapPin,
  PartyPopper,
  Plane,
  Timer,
  Users,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { EntityAvatar } from "@/components/shared/entity-avatar"

// ---------------------------------------------------------------------------
// Mock data — swap for real API calls
// ---------------------------------------------------------------------------

const PENDING_TASKS = 4 // New: Pending tasks counter
const PENDING_LEAVES = 2

const ACTIVE_TASK = {
  id: "t1",
  title: "Compile Q3 attendance report",
  requester: { name: "Dr. S. Jenkins", role: "FACULTY", department: "Computer Science" },
  startTime: "09:30",
  endTime: "11:00",
  location: "Block C · Room 204",
}

const UPCOMING_LEAVES = [
  { id: "1", type: "Annual leave", dates: "Jul 21 – Jul 23", days: 3, status: "APPROVED" as const, startDate: "2026-07-21", endDate: "2026-07-23" },
  { id: "2", type: "Casual leave", dates: "Aug 4", days: 1, status: "PENDING" as const, startDate: "2026-08-04", endDate: "2026-08-04" },
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
  
  // Hardcoded for demonstration of the active state
  const [attendance, setAttendance] = useState<AttendanceSummary>({
    checkedInAt: "08:58 AM",
    checkedOutAt: null,
    durationSoFar: "3h 19m",
    isOpen: true,
    status: "On time"
  })
  
  const [leaveSummary, setLeaveSummary] = useState<LeaveSummary>({ usedLeaveDays: 4, pendingLeaves: PENDING_LEAVES })
  const [upcomingLeaves, setUpcomingLeaves] = useState<UpcomingLeaveSummary[]>(UPCOMING_LEAVES)
  
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
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

  async function handlePunch() {
    if (!navigator.geolocation) {
      setError("Geolocation is required to punch attendance.")
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      // Simulate API call and Geolocation
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      if (isCheckedIn) {
        setAttendance(prev => ({ ...prev!, checkedOutAt: format(new Date(), "hh:mm a"), isOpen: false }))
      } else {
        setAttendance({ checkedInAt: format(new Date(), "hh:mm a"), checkedOutAt: null, durationSoFar: "0m", isOpen: true, status: "On time" })
      }
    } catch (punchError) {
      setError(punchError instanceof Error ? punchError.message : "Unable to update attendance")
    } finally {
      setActionLoading(false)
    }
  }

  const displayName = session?.user?.name ?? "Nitin"
  const departmentName = department?.name ?? "FSM"

  return (
    <TooltipProvider delay={0}>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Good afternoon, {displayName}
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {format(new Date(), "EEEE, MMMM d, yyyy")}
              <span className="text-slate-300">|</span>
              <span className="font-medium text-slate-700">{departmentName}</span>
            </p>
          </div>
          
          {/* Availability Status Pill */}
          <div className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ring-1",
            isCheckedIn ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
          )}>
            <div className={cn("h-2 w-2 rounded-full animate-pulse", isCheckedIn ? "bg-emerald-500" : "bg-slate-400")} />
            {isCheckedIn ? "Available for Booking" : "Offline"}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Top Row: Core Actions & Status */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          
          {/* 1. Punch In/Out Card */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <Fingerprint className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Today's Attendance</h2>
                  {isCheckedIn ? (
                     <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-max">
                        <MapPin className="h-3 w-3" /> Location Verified
                     </div>
                  ) : (
                    <p className="text-xs text-slate-500">Awaiting check-in</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex-1 space-y-3 mb-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <LogIn className="h-4 w-4 text-slate-400" /> Checked in
                </span>
                <span className="font-semibold text-slate-900">{attendance?.checkedInAt ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <LogOut className="h-4 w-4 text-slate-400" /> Checked out
                </span>
                <span className="font-semibold text-slate-900">
                  {attendance?.checkedOutAt ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                  <Timer className="h-4 w-4 text-slate-400" /> Duration
                </span>
                <span className="font-semibold text-indigo-600">
                  {attendance?.durationSoFar ?? "0m"}
                </span>
              </div>
            </div>
            
            <Button
              onClick={handlePunch}
              disabled={actionLoading}
              className={cn(
                "w-full rounded-xl px-4 py-6 text-sm font-bold shadow-md transition-all group-data-[collapsible=icon]:justify-center cursor-pointer",
                isCheckedIn 
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200/50 hover:shadow-lg"
              )}
            >
              {isCheckedIn ? (
                <>
                  <LogOut className="mr-2 h-5 w-5" />
                  {actionLoading ? "Processing..." : "Punch Out"}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  {actionLoading ? "Processing..." : "Punch In to become available"}
                </>
              )}
            </Button>
          </div>

          {/* 2. Active Task / Booking Widget */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
               <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Briefcase className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Current Assignment</h2>
                  <p className="text-xs text-slate-500">Booked by Faculty</p>
                </div>
            </div>

            {isCheckedIn && ACTIVE_TASK ? (
              <div className="flex flex-col flex-1 rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 tracking-wide">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    In Progress
                  </span>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {ACTIVE_TASK.startTime} – {ACTIVE_TASK.endTime}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-4">{ACTIVE_TASK.title}</h3>
                
                <div className="mt-auto pt-3 border-t border-slate-200/60 flex items-center gap-3">
                  <EntityAvatar name={ACTIVE_TASK.requester.name} size="sm" className="h-8 w-8" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{ACTIVE_TASK.requester.name}</p>
                    <p className="truncate text-xs text-slate-500">{ACTIVE_TASK.location}</p>
                  </div>
                </div>
              </div>
            ) : isCheckedIn && !ACTIVE_TASK ? (
               <div className="flex flex-col flex-1 items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                 <Briefcase className="h-8 w-8 text-slate-300 mb-2" />
                 <p className="text-sm font-semibold text-slate-900">Standby Mode</p>
                 <p className="text-xs text-slate-500 mt-1 max-w-[200px]">You are available for faculty bookings between 9:00 AM and 5:00 PM.</p>
               </div>
            ) : (
               <div className="flex flex-col flex-1 items-center justify-center text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 opacity-75">
                 <LogIn className="h-8 w-8 text-slate-300 mb-2" />
                 <p className="text-sm font-semibold text-slate-900">Offline</p>
                 <p className="text-xs text-slate-500 mt-1">Punch in to view active tasks and become bookable.</p>
               </div>
            )}
          </div>

          {/* 3. Workload & Leaves Stats */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{PENDING_TASKS}</p>
                <p className="text-sm font-medium text-slate-500">Tasks in Queue</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex-1">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                <Plane className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{leaveUsed} <span className="text-sm font-medium text-slate-500">days</span></p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                    {PENDING_LEAVES} Pending
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-500">Leave Taken This Year</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Calendar + Upcoming Leaves */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Calendar */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Attendance Calendar</h2>
                <p className="text-sm text-slate-500">Track your daily punches and absences.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl ring-1 ring-slate-200">
                <button
                  onClick={() => setMonth((m) => subMonths(m, 1))}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="w-28 text-center text-sm font-bold text-slate-900">
                  {format(month, "MMMM yyyy")}
                </span>
                <button
                  onClick={() => setMonth((m) => addMonths(m, 1))}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white hover:shadow-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                      "relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-xl text-sm transition-all duration-200",
                      selected
                        ? "bg-indigo-600 font-bold text-white shadow-md shadow-indigo-200"
                        : isToday(day)
                          ? "bg-indigo-50 font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"
                          : "text-slate-700 font-medium hover:bg-slate-100"
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
                      <TooltipTrigger>
                         <div>{content}</div>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center" className="bg-slate-900 text-white border-none shadow-lg">
                        <div className="space-y-0.5 text-left px-1 py-0.5">
                          <p className="font-semibold text-sm">{meta.label}</p>
                          <p className="text-[11px] text-slate-300">{format(day, "EEE, MMM d")}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <div key={day.toISOString()}>{content}</div>
                  )
                )
              })}
            </div>

            {/* Legend & Detail */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-5">
               <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                 {(
                   [
                     { label: "Present", cls: "bg-emerald-500" },
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
                 <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200 text-sm">
                   <CalendarDays className="h-4 w-4 text-indigo-600" />
                   <span className="font-semibold text-slate-900">{format(selectedDay, "MMM d")}:</span>
                   <span className="text-slate-600">{selectedMeta ? selectedMeta.label : "No record"}</span>
                 </div>
               )}
            </div>
          </div>

          {/* Right column: Upcoming Leaves + Holidays */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <h2 className="text-base font-bold text-slate-900">Upcoming Leaves</h2>
                <Plane className="h-4 w-4 text-indigo-600" />
              </div>

              <div className="space-y-3">
                {upcomingLeaves.length === 0 && (
                  <p className="py-4 text-center text-sm text-slate-500">No upcoming leaves.</p>
                )}
                {upcomingLeaves.map((leave) => (
                  <div key={leave.id} className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{leave.type}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {format(new Date(leave.startDate), "MMM d")} – {format(new Date(leave.endDate), "MMM d")}
                      </p>
                    </div>
                    <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        leave.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}
                    >
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="mt-4 w-full text-sm font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
                Request Time Off
              </Button>
            </div>
        </div>
      </div>
    </TooltipProvider>
  )
}