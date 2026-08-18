"use client"

import { useCallback, useEffect, useState } from "react"
import { format, parse } from "date-fns"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Fingerprint,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type AttendanceRow = {
  id: string
  date: string
  checkInAt: string
  checkOutAt: string | null
  status: "ON_TIME" | "LATE"
  flaggedOutsideGeofence: boolean
  hasLocation: boolean
  user: { id: string; name: string | null; email: string; photoUrl: string | null }
  department: { id: string; name: string }
}

type Department = { id: string; name: string }

const PAGE_SIZE = 15

const STATUS_STYLES = {
  ON_TIME: "bg-emerald-50 text-emerald-600",
  LATE: "bg-amber-50 text-amber-600",
} as const

const STATUS_LABEL = { ON_TIME: "On time", LATE: "Late" } as const

const to12Hour = (t: string) => format(parse(t, "HH:mm", new Date()), "h:mm a")

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "on-time", label: "On time" },
  { key: "late", label: "Late" },
] as const

type StatusKey = (typeof STATUS_FILTERS)[number]["key"]

export default function AdminAttendancePage() {
  const today = new Date()
  const [month, setMonth] = useState(String(today.getMonth() + 1))
  const [year, setYear] = useState(String(today.getFullYear()))
  const [departmentId, setDepartmentId] = useState("all")
  const [status, setStatus] = useState<StatusKey>("all")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)

  const [records, setRecords] = useState<AttendanceRow[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        month,
        year,
        status,
        departmentId,
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (q.trim()) params.set("q", q.trim())

      const res = await fetch(`/api/admin/attendance?${params}`)
      const data = await res.json()
      if (res.ok) {
        setRecords(data.records ?? [])
        setDepartments(data.departments ?? [])
        if (data.pagination) setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [month, year, status, departmentId, page, q])

  useEffect(() => {
    void load()
  }, [load])

  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - i))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Project Assistant check-in and check-out punches across all departments.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search PA by name or email…"
            className="rounded-lg pl-9"
          />
        </div>

        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {format(new Date(2000, i, 1), "MMMM")}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStatus(f.key)
                setPage(1)
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                status === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <Fingerprint className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">PA punches</h2>
          <span className="ml-auto text-sm text-slate-400">{pagination.total} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Project Assistant</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Check-in</th>
                <th className="px-5 py-3">Check-out</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    {loading ? "Loading attendance…" : "No punches match these filters."}
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar
                          name={r.user.name}
                          fallbackText={r.user.email}
                          imageUrl={r.user.photoUrl}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{r.user.name || r.user.email}</p>
                          <p className="truncate text-xs text-slate-400">{r.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{r.department.name}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span className="font-medium text-slate-900">{format(new Date(r.date), "MMM d, yyyy")}</span>
                      <span className="block text-xs text-slate-400">{format(new Date(r.date), "EEEE")}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">{to12Hour(r.checkInAt)}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {r.checkOutAt ? (
                        <span className="text-slate-600">{to12Hour(r.checkOutAt)}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                          Not punched out
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {!r.hasLocation ? (
                        <span className="text-xs text-slate-400">Not captured</span>
                      ) : r.flaggedOutsideGeofence ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600">
                          <AlertTriangle className="h-3 w-3" /> Off site
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[r.status]
                        )}
                      >
                        {r.status === "LATE" ? <Clock3 className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-700">{pagination.page}</span> of{" "}
              <span className="font-medium text-slate-700">{pagination.totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="cursor-pointer"
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
