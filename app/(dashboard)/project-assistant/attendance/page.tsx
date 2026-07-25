"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
} from "lucide-react"

import { AttendanceFilter, type AttendanceStatusFilter } from "@/components/shared/filters/attendance-filter"
import { PageHeader } from "@/components/shared/page-header"
import { TablePagination } from "@/components/shared/table-pagination"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types — the PA's own geolocated daily check-in / check-out, from
// GET /api/attendance/history.
// ---------------------------------------------------------------------------

type PunchLocation = {
  latitude: number
  longitude: number
  /** Punch landed outside every configured department geofence. */
  flagged: boolean
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

const today = new Date()


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 6

/** "09:04" → "9:04 AM" */
const to12Hour = (time: string) => format(parse(time, "HH:mm", new Date()), "h:mm a")

const PUNCH_STATUS_FILTER: Record<PunchStatus, AttendanceStatusFilter> = {
  ON_TIME: "on-time",
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

  const [punches, setPunches] = useState<SelfPunchRecord[]>([])
  const [stats, setStats] = useState({ daysPresent: 0, lateDays: 0, absentDays: 0 })
  const [loading, setLoading] = useState(true)

  // The period filter is applied server-side; status filtering and paging stay
  // client-side since a single period is small.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/history?month=${month}&year=${year}`)
      const data = await res.json()
      if (res.ok) {
        setPunches(data.punches ?? [])
        setStats(data.stats ?? { daysPresent: 0, lateDays: 0, absentDays: 0 })
      }
    } catch {
      // tables fall back to their empty states
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    void load()
  }, [load])

  // Any filter change invalidates the current page position.
  const resetPages = () => {
    setPunchPage(1)
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

  const filteredPunches = useMemo(
    () =>
      punches
        .filter((punch) => status === "all" || PUNCH_STATUS_FILTER[punch.status] === status)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [punches, status]
  )

  // Clamp against a page that a filter change may have left out of range.
  const safePunchPage = Math.min(punchPage, Math.max(1, Math.ceil(filteredPunches.length / PAGE_SIZE)))

  const pagedPunches = filteredPunches.slice((safePunchPage - 1) * PAGE_SIZE, safePunchPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="Your geolocated daily check-in and check-out punches." />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
          label="Total Days Present"
          value={stats.daysPresent}
          hint={`Days with a successful check-in punch · ${periodLabel}`}
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
          label="Late Arrivals"
          value={stats.lateDays}
          hint={`Punches after your shift start window · ${periodLabel}`}
        />
        <StatCard
          icon={<CalendarX className="h-5 w-5" />}
          accent="bg-red-50 text-red-600"
          label="Absent Days"
          value={stats.absentDays}
          hint={`Working days with no punch at all · ${periodLabel}`}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
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
                        {loading ? "Loading your punches…" : "No punches match these filters."}
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
                              {punch.location.flagged ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                                  <AlertTriangle className="h-3 w-3" /> Off site
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </span>
                              )}
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
      </div>
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
