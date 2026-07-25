"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, RefreshCw, Search, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  rating: number | null
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  faculty: { id: string; name: string | null; username: string; email: string; photoUrl: string | null }
  pa: { id: string; name: string | null; username: string; email: string; photoUrl: string | null }
  department: { id: string; name: string } | null
}

const STATUS_STYLES: Record<Booking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  ABSENT: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
}

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "IN_PROGRESS", label: "Running" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Closed" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

const PAGE_SIZE = 15

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats] = useState({ upcoming: 0, inProgress: 0, completed: 0 })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [filter, setFilter] = useState<FilterKey>("ALL")
  const [page, setPage] = useState(1)
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (filter !== "ALL") params.set("bucket", filter)

      const res = await fetch(`/api/bookings?${params}`)
      const data = await res.json()
      if (res.ok) {
        setBookings(data.bookings ?? [])
        if (data.pagination) setPagination(data.pagination)
        if (data.stats) setStats(data.stats)
      }
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    void load()
  }, [load])

  // Search narrows the current page client-side; the period/bucket filters are server-side.
  const term = q.trim().toLowerCase()
  const visible = term
    ? bookings.filter((b) =>
        [
          b.faculty.name,
          b.faculty.username,
          b.pa.name,
          b.pa.username,
          b.department?.name,
          b.workType,
          b.task,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
    : bookings

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            PA slot-booking history across departments. Open a booking for its full timeline.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total" value={pagination.total} />
        <Stat label="Upcoming" value={stats.upcoming} accent="text-indigo-600" />
        <Stat label="Running / unresolved" value={stats.inProgress} accent="text-amber-600" />
        <Stat label="Completed" value={stats.completed} accent="text-emerald-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this page by faculty, PA, department or task…"
            className="rounded-lg pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key)
                setPage(1)
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Project Assistant</th>
                <th className="px-4 py-3">Booked by</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Work type</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    {loading ? "Loading…" : "No bookings match these filters."}
                  </td>
                </tr>
              ) : (
                visible.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar
                          name={b.pa.name || b.pa.username}
                          fallbackText={b.pa.name || b.pa.username}
                          imageUrl={b.pa.photoUrl}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{b.pa.name || b.pa.username}</p>
                          <p className="truncate text-xs text-slate-400">{b.pa.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {b.faculty.name || b.faculty.username}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{b.department?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {format(new Date(b.date), "MMM d, yyyy")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {format(new Date(b.startTime), "h:mm a")}–{format(new Date(b.endTime), "h:mm a")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {b.workType ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {b.workType}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {b.rating != null ? (
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-medium">{b.rating}/5</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[b.status]
                        )}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          Details <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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
              <span className="font-medium text-slate-700">{pagination.totalPages}</span> ·{" "}
              {pagination.total} bookings
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
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold text-slate-900", accent)}>{value}</p>
    </div>
  )
}
