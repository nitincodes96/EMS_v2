"use client"

import { useMemo, useState } from "react"
import { format, parse } from "date-fns"
import {
  AlertTriangle,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock3,
  Fingerprint,
  MapPin,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

import { AttendanceFilter, type AttendanceStatusFilter } from "@/components/shared/filters/attendance-filter"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { TablePagination } from "@/components/shared/table-pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types — two independent sources of attendance:
//   1. Self punches      → the PA's own geolocated daily check-in / check-out.
//   2. Faculty markings  → per-booking attendance marked by the booking faculty.
// Swap the mock arrays for real API calls once both are tracked in the schema.
// ---------------------------------------------------------------------------

type PunchLocation = {
  latitude: number
  longitude: number
  accuracyMeters: number
}

/** ON_TIME / LATE are derived from the 09:00 shift start; ABSENT = no punch that day. */
type PunchStatus = "ON_TIME" | "LATE" | "ABSENT"

type SelfPunchRecord = {
  id: string
  date: string // yyyy-MM-dd
  checkInAt: string | null // HH:mm (24h), null when absent
  checkOutAt: string | null // null = still checked in / never punched out
  /** Device coordinates captured at punch-in. null = geolocation unavailable or absent. */
  location: PunchLocation | null
  status: PunchStatus
}

type BookingAttendanceStatus = "COMPLETED" | "LATE" | "ABSENT"

type BookingAttendanceRecord = {
  id: string
  date: string // yyyy-MM-dd
  startTime: string // HH:mm, within the 09:00–17:00 availability window
  endTime: string // HH:mm, within the 09:00–17:00 availability window
  facultyName: string
  task: string
  status: BookingAttendanceStatus
}

// ---------------------------------------------------------------------------
// Mock data — spans three months so month/year filtering and paging are visible
// ---------------------------------------------------------------------------

const today = new Date()
const iso = (offsetDays: number) =>
  format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays), "yyyy-MM-dd")

const SELF_PUNCHES: SelfPunchRecord[] = [
  // Still checked in — no check-out yet.
  { id: "p1", date: iso(0), checkInAt: "09:04", checkOutAt: null, location: { latitude: 28.5449, longitude: 77.1926, accuracyMeters: 12 }, status: "ON_TIME" },
  { id: "p2", date: iso(-1), checkInAt: "09:12", checkOutAt: "17:36", location: { latitude: 28.5451, longitude: 77.1929, accuracyMeters: 9 }, status: "ON_TIME" },
  // Forgot to punch out at the end of the day.
  { id: "p3", date: iso(-2), checkInAt: "08:57", checkOutAt: null, location: { latitude: 28.5447, longitude: 77.1922, accuracyMeters: 15 }, status: "ON_TIME" },
  { id: "p4", date: iso(-3), checkInAt: "09:41", checkOutAt: "18:02", location: { latitude: 28.5452, longitude: 77.1931, accuracyMeters: 22 }, status: "LATE" },
  // Device denied geolocation — punch recorded but unverified.
  { id: "p5", date: iso(-4), checkInAt: "09:02", checkOutAt: "17:14", location: null, status: "ON_TIME" },
  // No punch at all that day.
  { id: "p6", date: iso(-5), checkInAt: null, checkOutAt: null, location: null, status: "ABSENT" },
  { id: "p7", date: iso(-7), checkInAt: "09:08", checkOutAt: "17:29", location: { latitude: 28.5448, longitude: 77.1925, accuracyMeters: 11 }, status: "ON_TIME" },
  { id: "p8", date: iso(-8), checkInAt: "09:23", checkOutAt: "16:58", location: { latitude: 28.545, longitude: 77.1927, accuracyMeters: 8 }, status: "LATE" },
  { id: "p9", date: iso(-9), checkInAt: "08:52", checkOutAt: "17:41", location: { latitude: 28.5449, longitude: 77.1924, accuracyMeters: 14 }, status: "ON_TIME" },
  { id: "p10", date: iso(-10), checkInAt: "09:06", checkOutAt: "17:18", location: { latitude: 28.5453, longitude: 77.1928, accuracyMeters: 10 }, status: "ON_TIME" },
  { id: "p11", date: iso(-11), checkInAt: null, checkOutAt: null, location: null, status: "ABSENT" },
  { id: "p12", date: iso(-14), checkInAt: "09:34", checkOutAt: "17:52", location: { latitude: 28.5446, longitude: 77.1923, accuracyMeters: 18 }, status: "LATE" },
  { id: "p13", date: iso(-15), checkInAt: "09:01", checkOutAt: "17:07", location: { latitude: 28.5451, longitude: 77.193, accuracyMeters: 7 }, status: "ON_TIME" },
  // Previous month
  { id: "p14", date: iso(-32), checkInAt: "09:09", checkOutAt: "17:22", location: { latitude: 28.5449, longitude: 77.1926, accuracyMeters: 13 }, status: "ON_TIME" },
  { id: "p15", date: iso(-33), checkInAt: "09:47", checkOutAt: "18:11", location: { latitude: 28.545, longitude: 77.1929, accuracyMeters: 25 }, status: "LATE" },
  { id: "p16", date: iso(-36), checkInAt: null, checkOutAt: null, location: null, status: "ABSENT" },
  { id: "p17", date: iso(-45), checkInAt: "08:58", checkOutAt: "17:03", location: null, status: "ON_TIME" },
  // Two months back
  { id: "p18", date: iso(-62), checkInAt: "09:15", checkOutAt: "17:44", location: { latitude: 28.5448, longitude: 77.1927, accuracyMeters: 16 }, status: "ON_TIME" },
]

const FACULTY_MARKINGS: BookingAttendanceRecord[] = [
  { id: "b1", date: iso(0), startTime: "09:30", endTime: "11:00", facultyName: "Dr. S. Jenkins", task: "Compile Q3 attendance report", status: "COMPLETED" },
  { id: "b2", date: iso(0), startTime: "13:00", endTime: "14:00", facultyName: "Prof. R. Mehta", task: "Seminar hall booking sheet", status: "COMPLETED" },
  { id: "b3", date: iso(-1), startTime: "10:00", endTime: "12:00", facultyName: "Dr. S. Jenkins", task: "Client proposal formatting", status: "COMPLETED" },
  // Marked absent by faculty — PA never reported for the slot.
  { id: "b4", date: iso(-1), startTime: "15:00", endTime: "17:00", facultyName: "Prof. A. Iyer", task: "Lab equipment audit", status: "ABSENT" },
  { id: "b5", date: iso(-2), startTime: "09:00", endTime: "10:30", facultyName: "Prof. R. Mehta", task: "Faculty meeting minutes", status: "COMPLETED" },
  // Reported, but after the slot had started.
  { id: "b6", date: iso(-3), startTime: "11:00", endTime: "12:30", facultyName: "Prof. A. Iyer", task: "Department inventory sheet", status: "LATE" },
  { id: "b7", date: iso(-4), startTime: "14:00", endTime: "16:00", facultyName: "Dr. S. Jenkins", task: "Guest lecture coordination", status: "ABSENT" },
  { id: "b8", date: iso(-5), startTime: "09:00", endTime: "11:00", facultyName: "Prof. R. Mehta", task: "Exam hall seating chart", status: "ABSENT" },
  { id: "b9", date: iso(-7), startTime: "13:30", endTime: "15:00", facultyName: "Prof. A. Iyer", task: "Infrastructure sync", status: "COMPLETED" },
  { id: "b10", date: iso(-8), startTime: "10:00", endTime: "11:30", facultyName: "Dr. S. Jenkins", task: "Research grant paperwork", status: "LATE" },
  { id: "b11", date: iso(-10), startTime: "09:00", endTime: "12:00", facultyName: "Prof. R. Mehta", task: "Workshop registration desk", status: "COMPLETED" },
  { id: "b12", date: iso(-14), startTime: "15:30", endTime: "17:00", facultyName: "Prof. A. Iyer", task: "Lab safety briefing", status: "COMPLETED" },
  { id: "b13", date: iso(-15), startTime: "11:00", endTime: "13:00", facultyName: "Dr. S. Jenkins", task: "Conference travel forms", status: "ABSENT" },
  // Previous month
  { id: "b14", date: iso(-32), startTime: "09:30", endTime: "11:30", facultyName: "Prof. R. Mehta", task: "Semester timetable draft", status: "COMPLETED" },
  { id: "b15", date: iso(-33), startTime: "14:00", endTime: "15:30", facultyName: "Prof. A. Iyer", task: "Equipment vendor calls", status: "LATE" },
  { id: "b16", date: iso(-36), startTime: "10:00", endTime: "12:00", facultyName: "Dr. S. Jenkins", task: "Student project reviews", status: "ABSENT" },
  { id: "b17", date: iso(-45), startTime: "13:00", endTime: "16:00", facultyName: "Prof. R. Mehta", task: "Accreditation file prep", status: "COMPLETED" },
  // Two months back
  { id: "b18", date: iso(-62), startTime: "09:00", endTime: "10:00", facultyName: "Prof. A. Iyer", task: "Inventory reconciliation", status: "COMPLETED" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6

/** "09:04" → "9:04 AM" */
const to12Hour = (time: string) => format(parse(time, "HH:mm", new Date()), "h:mm a")

/** yyyy-MM-dd → "7" / "2026" without going through a Date (avoids TZ drift). */
const monthOf = (date: string) => String(Number(date.slice(5, 7)))
const yearOf = (date: string) => date.slice(0, 4)

const matchesPeriod = (date: string, month: string, year: string) =>
  (month === "all" || monthOf(date) === month) && (year === "all" || yearOf(date) === year)

const PUNCH_STATUS_FILTER: Record<PunchStatus, AttendanceStatusFilter> = {
  ON_TIME: "on-time",
  LATE: "late",
  ABSENT: "absent",
}

const BOOKING_STATUS_FILTER: Record<BookingAttendanceStatus, AttendanceStatusFilter> = {
  COMPLETED: "on-time",
  LATE: "late",
  ABSENT: "absent",
}

const PUNCH_STATUS_STYLES: Record<PunchStatus, string> = {
  ON_TIME: "bg-emerald-50 text-emerald-600",
  LATE: "bg-amber-50 text-amber-600",
  ABSENT: "bg-red-50 text-red-600 ring-1 ring-red-200",
}

const PUNCH_STATUS_LABEL: Record<PunchStatus, string> = {
  ON_TIME: "On time",
  LATE: "Late",
  ABSENT: "Absent",
}

const BOOKING_STATUS_STYLES: Record<BookingAttendanceStatus, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-600",
  LATE: "bg-amber-50 text-amber-600",
  ABSENT: "bg-red-50 text-red-600 ring-1 ring-red-200",
}

const BOOKING_STATUS_LABEL: Record<BookingAttendanceStatus, string> = {
  COMPLETED: "Completed",
  LATE: "Late",
  ABSENT: "Absent",
}

function StatusIcon({ kind, className }: { kind: AttendanceStatusFilter; className?: string }) {
  if (kind === "absent") return <AlertTriangle className={className} />
  if (kind === "late") return <Clock3 className={className} />
  return <CheckCircle2 className={className} />
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PAAttendancePage() {
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const [status, setStatus] = useState<AttendanceStatusFilter>("all")
  const [punchPage, setPunchPage] = useState(1)
  const [markingPage, setMarkingPage] = useState(1)

  // Any filter change invalidates the current page position.
  const resetPages = () => {
    setPunchPage(1)
    setMarkingPage(1)
  }

  const handleMonthChange = (value: string) => {
    setMonth(value)
    resetPages()
  }

  const handleYearChange = (value: string) => {
    setYear(value)
    resetPages()
  }

  const handleStatusChange = (value: AttendanceStatusFilter) => {
    setStatus(value)
    resetPages()
  }

  const resetFilters = () => {
    setMonth("all")
    setYear("all")
    setStatus("all")
    resetPages()
  }

  const periodLabel =
    month === "all" && year === "all"
      ? "all time"
      : month === "all"
        ? year
        : `${format(new Date(2000, Number(month) - 1, 1), "MMMM")}${year === "all" ? "" : ` ${year}`}`

  // Stats follow the selected period but ignore the status filter — they are the
  // headline numbers for that month, not a count of whatever the table shows.
  const stats = useMemo(() => {
    const punchesInPeriod = SELF_PUNCHES.filter((p) => matchesPeriod(p.date, month, year))
    const markingsInPeriod = FACULTY_MARKINGS.filter((b) => matchesPeriod(b.date, month, year))
    return {
      daysPresent: punchesInPeriod.filter((p) => p.status !== "ABSENT").length,
      missedSlots: markingsInPeriod.filter((b) => b.status === "ABSENT").length,
    }
  }, [month, year])

  const filteredPunches = useMemo(
    () =>
      SELF_PUNCHES.filter(
        (punch) =>
          matchesPeriod(punch.date, month, year) &&
          (status === "all" || PUNCH_STATUS_FILTER[punch.status] === status)
      ).sort((a, b) => b.date.localeCompare(a.date)),
    [month, year, status]
  )

  const filteredMarkings = useMemo(
    () =>
      FACULTY_MARKINGS.filter(
        (slot) =>
          matchesPeriod(slot.date, month, year) &&
          (status === "all" || BOOKING_STATUS_FILTER[slot.status] === status)
      ).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [month, year, status]
  )

  // Clamp against a page that a filter change may have left out of range.
  const safePunchPage = Math.min(punchPage, Math.max(1, Math.ceil(filteredPunches.length / PAGE_SIZE)))
  const safeMarkingPage = Math.min(markingPage, Math.max(1, Math.ceil(filteredMarkings.length / PAGE_SIZE)))

  const pagedPunches = filteredPunches.slice((safePunchPage - 1) * PAGE_SIZE, safePunchPage * PAGE_SIZE)
  const pagedMarkings = filteredMarkings.slice((safeMarkingPage - 1) * PAGE_SIZE, safeMarkingPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Your geolocated daily punches, and the booking slots faculty marked you on."
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
          label="Total Days Present"
          value={stats.daysPresent}
          hint={`Days with a successful check-in punch · ${periodLabel}`}
        />
        <StatCard
          icon={<CalendarX className="h-5 w-5" />}
          accent="bg-red-50 text-red-600"
          label="Missed Booking Slots"
          value={stats.missedSlots}
          hint={`Slots a faculty member marked you absent for · ${periodLabel}`}
        />
      </div>

      <Tabs defaultValue="punches">
        {/* Tabs left, filters right — both filters and tabs drive the tables below */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <TabsList className="grid w-full max-w-xs grid-cols-2 sm:w-auto">
            <TabsTrigger value="punches" className="gap-1.5 text-xs sm:text-sm">
              <Fingerprint className="h-3.5 w-3.5" /> My Punches
            </TabsTrigger>
            <TabsTrigger value="markings" className="gap-1.5 text-xs sm:text-sm">
              <UserCheck className="h-3.5 w-3.5" /> Faculty Markings
            </TabsTrigger>
          </TabsList>

          <AttendanceFilter
            filterMonth={month}
            filterYear={year}
            filterStatus={status}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
            onStatusChange={handleStatusChange}
            onReset={resetFilters}
          />
        </div>

        {/* Tab 1 — self attendance */}
        <TabsContent value="punches" className="mt-4">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Fingerprint className="h-4 w-4 text-indigo-600" /> Daily self-attendance
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Punched from your device. Coordinates are captured at check-in to verify you were on site.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Check-in</th>
                    <th className="px-5 py-3">Check-out</th>
                    <th className="px-5 py-3">Location</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPunches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                        No punches match these filters.
                      </td>
                    </tr>
                  ) : (
                    pagedPunches.map((punch) => (
                      <tr
                        key={punch.id}
                        className={cn(
                          "border-b border-slate-50 last:border-0",
                          punch.status === "ABSENT" && "bg-red-50/40"
                        )}
                      >
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="font-medium text-slate-900">
                            {format(new Date(punch.date), "MMM d, yyyy")}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {format(new Date(punch.date), "EEEE")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {punch.checkInAt ? to12Hour(punch.checkInAt) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {punch.checkOutAt ? (
                            <span className="text-slate-600">{to12Hour(punch.checkOutAt)}</span>
                          ) : punch.checkInAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                              Not punched out
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          {punch.location ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600">
                                <ShieldCheck className="h-3 w-3" /> Verified
                              </span>
                              <span className="hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex">
                                <MapPin className="h-3 w-3" />
                                {punch.location.latitude.toFixed(4)}, {punch.location.longitude.toFixed(4)}
                                <span className="text-slate-300">· ±{punch.location.accuracyMeters}m</span>
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                              <MapPin className="h-3 w-3" /> Not captured
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              PUNCH_STATUS_STYLES[punch.status]
                            )}
                          >
                            <StatusIcon kind={PUNCH_STATUS_FILTER[punch.status]} className="h-3 w-3" />
                            {PUNCH_STATUS_LABEL[punch.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={safePunchPage}
              pageSize={PAGE_SIZE}
              total={filteredPunches.length}
              onPageChange={setPunchPage}
            />
          </section>
        </TabsContent>

        {/* Tab 2 — booking attendance marked by faculty */}
        <TabsContent value="markings" className="mt-4">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <UserCheck className="h-4 w-4 text-indigo-600" /> Booking slot attendance
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Marked by the booking faculty. Slots fall within your 9:00 AM – 5:00 PM availability window.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Time slot</th>
                    <th className="px-5 py-3">Faculty</th>
                    <th className="px-5 py-3">Task</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedMarkings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                        No booking slots match these filters.
                      </td>
                    </tr>
                  ) : (
                    pagedMarkings.map((slot) => (
                      <tr
                        key={slot.id}
                        className={cn(
                          "border-b border-slate-50 last:border-0",
                          slot.status === "ABSENT" && "bg-red-50/40"
                        )}
                      >
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="font-medium text-slate-900">
                            {format(new Date(slot.date), "MMM d, yyyy")}
                          </span>
                          <span className="block text-xs text-slate-400">
                            {format(new Date(slot.date), "EEEE")}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {to12Hour(slot.startTime)} – {to12Hour(slot.endTime)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex items-center gap-2">
                            <EntityAvatar name={slot.facultyName} size="sm" className="h-6 w-6" />
                            <span className="text-slate-600">{slot.facultyName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{slot.task}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              BOOKING_STATUS_STYLES[slot.status]
                            )}
                          >
                            <StatusIcon kind={BOOKING_STATUS_FILTER[slot.status]} className="h-3 w-3" />
                            {BOOKING_STATUS_LABEL[slot.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={safeMarkingPage}
              pageSize={PAGE_SIZE}
              total={filteredMarkings.length}
              onPageChange={setMarkingPage}
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({
  icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>{icon}</span>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-xs text-slate-400">{hint}</p>
    </div>
  )
}
