"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, isToday, isTomorrow } from "date-fns"
import {
  ArrowRight,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Hourglass,
  ListTodo,
  LoaderCircle,
  RefreshCw,
  Star,
  UserX,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingStatus = "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: BookingStatus
  rating: number | null
  faculty: { id: string; name: string | null; username: string; email: string; photoUrl: string | null }
  department: { id: string; name: string } | null
}

/** Status shown on a card — derived from the booking status plus the clock. */
type TaskStatus = "UPCOMING" | "IN_PROGRESS" | "AWAITING" | "COMPLETED" | "ABSENT" | "CANCELLED"

type FilterKey = "ALL" | "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CLOSED"

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; accent: string; glow: string; icon: React.ReactNode }
> = {
  UPCOMING: {
    label: "Upcoming",
    badge: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60",
    accent: "border-l-slate-300",
    glow: "group-hover:shadow-slate-200/50",
    icon: <Clock3 className="h-3 w-3" />,
  },
  IN_PROGRESS: {
    label: "In Progress",
    badge: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
    accent: "border-l-indigo-500",
    glow: "group-hover:shadow-indigo-200/50",
    icon: <LoaderCircle className="h-3 w-3 animate-spin" />,
  },
  AWAITING: {
    label: "Awaiting confirmation",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
    accent: "border-l-amber-400",
    glow: "group-hover:shadow-amber-200/50",
    icon: <Hourglass className="h-3 w-3" />,
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    accent: "border-l-emerald-500",
    glow: "group-hover:shadow-emerald-200/50",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  ABSENT: {
    label: "Marked absent",
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
    accent: "border-l-red-500",
    glow: "group-hover:shadow-red-200/50",
    icon: <UserX className="h-3 w-3" />,
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-slate-100 text-slate-500 ring-1 ring-slate-200/60",
    accent: "border-l-slate-200",
    glow: "group-hover:shadow-slate-200/50",
    icon: <Ban className="h-3 w-3" />,
  },
}

const STATUS_RANK: Record<TaskStatus, number> = {
  IN_PROGRESS: 0,
  AWAITING: 1,
  UPCOMING: 2,
  COMPLETED: 3,
  ABSENT: 4,
  CANCELLED: 5,
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All Tasks" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Closed" },
]

const PAGE_SIZE = 12

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(booking: Booking, now: Date): TaskStatus {
  if (booking.status === "COMPLETED") return "COMPLETED"
  if (booking.status === "ABSENT") return "ABSENT"
  if (booking.status === "CANCELLED") return "CANCELLED"

  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  if (now < start) return "UPCOMING"
  if (now <= end) return "IN_PROGRESS"
  return "AWAITING"
}

function relativeDay(date: string) {
  const parsed = new Date(date)
  if (isToday(parsed)) return "Today"
  if (isTomorrow(parsed)) return "Tomorrow"
  return format(parsed, "EEE, MMM d")
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PATasksPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("ALL")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [stats, setStats] = useState({ upcoming: 0, inProgress: 0, completed: 0 })

  // Only the current page is fetched, so a long history stays fast to load
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
    } catch {
      // surfaced by the empty state
    } finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => {
    void load()
  }, [load])

  function changeFilter(next: FilterKey) {
    setFilter(next)
    setPage(1)
  }

  const visible = useMemo(() => {
    const now = new Date()
    return bookings
      .map((b) => ({ booking: b, status: deriveStatus(b, now) }))
      .sort(
        (a, b) =>
          STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
          a.booking.date.localeCompare(b.booking.date) ||
          a.booking.startTime.localeCompare(b.booking.startTime)
      )
  }, [bookings])

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="My Tasks"
          description="Work assigned to you by faculty. Punch in to stay bookable during the day."
        />
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Workload Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ListTodo className="h-5 w-5" />}
          accent="bg-slate-100 text-slate-700 ring-slate-200"
          label="Upcoming Tasks"
          value={stats.upcoming}
        />
        <StatCard
          icon={<LoaderCircle className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600 ring-indigo-100"
          label="In Progress"
          value={stats.inProgress}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 ring-emerald-100"
          label="Completed"
          value={stats.completed}
        />
      </div>

      {/* Feed & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Task Overview</h2>

        <div className="inline-flex flex-wrap rounded-xl bg-slate-100/80 p-1 shadow-sm ring-1 ring-slate-200/50">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => changeFilter(f.key)}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200",
                filter === f.key
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && bookings.length === 0 ? (
        <p className="py-24 text-center text-sm text-slate-400">Loading your tasks…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
            <ListTodo className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="mt-5 text-base font-semibold text-slate-900">No tasks found</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {filter === "ALL"
              ? "No faculty has booked you yet. Punch in to become available for bookings."
              : "Nothing in this view — try a different filter."}
          </p>
        </div>
      ) : (
        <>
          <div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}>
            {visible.map(({ booking, status }) => (
              <TaskCard key={booking.id} booking={booking} status={status} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row">
              <p className="text-sm text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {(pagination.page - 1) * PAGE_SIZE + 1}–
                  {Math.min(pagination.page * PAGE_SIZE, pagination.total)}
                </span>{" "}
                of <span className="font-medium text-slate-700">{pagination.total}</span> tasks
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

                <span className="px-3 text-sm font-medium text-slate-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

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
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function TaskCard({ booking, status }: { booking: Booking; status: TaskStatus }) {
  const config = STATUS_CONFIG[status]
  const facultyName = booking.faculty.name || booking.faculty.username

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border border-l-4 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        config.accent,
        config.glow
      )}
    >
      {/* Header: Status + Date */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
            config.badge
          )}
        >
          {config.icon}
          {config.label}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
          {relativeDay(booking.date)}
        </span>
      </div>

      {/* Work type + slot */}
      <h3 className="text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-indigo-600">
        {booking.workType ?? "Assigned task"}
      </h3>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/50">
          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
          {format(new Date(booking.startTime), "h:mm a")}
          <ArrowRight className="mx-0.5 h-3 w-3 text-slate-300" />
          {format(new Date(booking.endTime), "h:mm a")}
        </div>

        {booking.rating != null && (
          <div className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200/50">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {booking.rating}/5
          </div>
        )}
      </div>

      {/* Instructions */}
      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">{booking.task}</p>

      {/* Footer: requester */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <EntityAvatar
            name={facultyName}
            fallbackText={facultyName}
            imageUrl={booking.faculty.photoUrl}
            size="sm"
            className="h-9 w-9 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{facultyName}</p>
            <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              Faculty
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t border-slate-200/60 pt-2 text-xs font-medium text-slate-500">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="truncate">{booking.department?.name ?? "—"}</span>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Stat
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  accent,
  label,
  value,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", accent)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}
