"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Check, ChevronRight, RefreshCw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/shared/search-input"
import { TablePagination } from "@/components/shared/table-pagination"
import { cn } from "@/lib/utils"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"
  paStatus: "DONE" | "NOT_DONE" | null
  createdAt: string
  pa: { id: string; name: string | null; email: string }
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

const STATUS_STYLES: Record<Booking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  INCOMPLETE: "bg-amber-50 text-amber-700",
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

// Counts shown on the filter pills. ALL/CLOSED have no dedicated server count.
type Stats = { upcoming: number; inProgress: number; completed: number }
const FILTER_COUNTS: Partial<Record<FilterKey, (s: Stats) => number>> = {
  UPCOMING: (s) => s.upcoming,
  IN_PROGRESS: (s) => s.inProgress,
  COMPLETED: (s) => s.completed,
}

function PaStatusBadge({ paStatus }: { paStatus: Booking["paStatus"] }) {
  if (!paStatus) return <span className="text-xs text-slate-300">—</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        paStatus === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      )}
    >
      {paStatus === "DONE" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {paStatus === "DONE" ? "Done" : "Not done"}
    </span>
  )
}

export default function FacultyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("ALL")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats>({ upcoming: 0, inProgress: 0, completed: 0 })

  // Debounce typing so we don't fetch on every keystroke; reset to page 1 on change
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Only the current page is fetched, so a long booking history stays fast to load.
  // Sorted by when the booking was made (newest first) rather than the slot's
  // own date, so the list reads as a history you can scan top-to-bottom.
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort: "createdAt" })
      if (filter !== "ALL") params.set("bucket", filter)
      if (debouncedSearch) params.set("q", debouncedSearch)

      const res = await fetch(`/api/bookings?${params}`)
      const data = await res.json()
      if (res.ok) {
        setBookings(data.bookings ?? [])
        setTotal(data.pagination?.total ?? 0)
        if (data.stats) setStats(data.stats)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filter, debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  function changePageSize(size: number) {
    setPageSize(size)
    setPage(1)
  }

  function changeFilter(next: FilterKey) {
    setFilter(next)
    setPage(1)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Bookings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track PAs you booked. Open a booking to reschedule, cancel, or record its outcome.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by PA, work type or task…"
          className="min-w-55 flex-1"
        />

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => {
            const count = FILTER_COUNTS[f.key]?.(stats)
            return (
              <button
                key={f.key}
                onClick={() => changeFilter(f.key)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {f.label}
                {count != null && (
                  <span
                    className={cn(
                      "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                      filter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Project Assistant</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Slot</th>
                <th className="px-4 py-3">Work type</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">PA report</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading…</td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    {debouncedSearch || filter !== "ALL" ? "No bookings match these filters." : "No bookings yet."}
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{b.pa.name || b.pa.email}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{format(new Date(b.date), "MMM d, yyyy")}</p>
                      <p className="text-xs text-slate-400">Booked {format(new Date(b.createdAt), "MMM d, yyyy")}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
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
                    <td className="max-w-xs truncate px-4 py-3 text-slate-600">{b.task}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[b.status])}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PaStatusBadge paStatus={b.paStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          href={`/faculty/bookings/${b.id}`}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          Manage <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={changePageSize}
        />
      </div>
    </div>
  )
}
