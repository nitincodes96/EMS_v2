"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, isToday, isTomorrow } from "date-fns"
import {
  Ban,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Info,
  ListTodo,
  Mail,
  RefreshCw,
  Search,
  Star,
  UserX,
  XCircle,
} from "lucide-react"

import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { TablePagination } from "@/components/shared/table-pagination"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingStatus = "BOOKED" | "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"

type PaWorkStatus = "DONE" | "NOT_DONE"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: BookingStatus
  rating: number | null
  paStatus: PaWorkStatus | null
  paRemark: string | null
  paMarkedAt: string | null
  createdAt: string
  faculty: { id: string; name: string | null; email: string; photoUrl: string | null }
  department: { id: string; name: string } | null
}

/** Status shown on a card — derived from the booking status plus the clock. */
type TaskStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"

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
    icon: <CircleDot className="h-3 w-3" />,
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    accent: "border-l-emerald-500",
    glow: "group-hover:shadow-emerald-200/50",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  INCOMPLETE: {
    label: "Not completed",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
    accent: "border-l-amber-500",
    glow: "group-hover:shadow-amber-200/50",
    icon: <XCircle className="h-3 w-3" />,
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
  UPCOMING: 1,
  COMPLETED: 2,
  INCOMPLETE: 3,
  ABSENT: 4,
  CANCELLED: 5,
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CLOSED", label: "Closed" },
]

// Counts shown on the filter pills. ALL/CLOSED have no dedicated server count.
type Stats = { upcoming: number; inProgress: number; completed: number }
const FILTER_COUNTS: Partial<Record<FilterKey, (s: Stats) => number>> = {
  UPCOMING: (s) => s.upcoming,
  IN_PROGRESS: (s) => s.inProgress,
  COMPLETED: (s) => s.completed,
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveStatus(booking: Booking, now: Date): TaskStatus {
  if (booking.status === "COMPLETED") return "COMPLETED"
  if (booking.status === "INCOMPLETE") return "INCOMPLETE"
  if (booking.status === "ABSENT") return "ABSENT"
  if (booking.status === "CANCELLED") return "CANCELLED"

  // A booking the faculty hasn't closed out yet stays "In Progress" once it
  // has started, whether it's running now or its slot has already passed.
  const start = new Date(booking.startTime)
  if (now < start) return "UPCOMING"
  return "IN_PROGRESS"
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
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [stats, setStats] = useState({ upcoming: 0, inProgress: 0, completed: 0 })

  // A ?bookingId= handoff (e.g. from the "View booking" link on the calendar)
  // opens that booking's details directly, regardless of the current page/filter.
  const [deepLinkBooking, setDeepLinkBooking] = useState<Booking | null>(null)
  const [deepLinkReportOpen, setDeepLinkReportOpen] = useState(false)

  const loadDeepLink = useCallback(async (bookingId: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`)
      const data = await res.json()
      if (res.ok) setDeepLinkBooking(data.booking)
      else toast.error(data?.error || "Could not load that booking")
    } catch {
      toast.error("Could not load that booking")
    }
  }, [])

  useEffect(() => {
    const bookingId = new URLSearchParams(window.location.search).get("bookingId")
    if (bookingId) void loadDeepLink(bookingId)
  }, [loadDeepLink])

  function closeDeepLink() {
    setDeepLinkBooking(null)
    setDeepLinkReportOpen(false)
    window.history.replaceState(null, "", "/project-assistant/tasks")
  }

  // Debounce typing so we don't fetch on every keystroke; reset to page 1 on change
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Only the current page is fetched, so a long history stays fast to load
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (filter !== "ALL") params.set("bucket", filter)
      if (debouncedSearch) params.set("q", debouncedSearch)

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
  }, [page, pageSize, filter, debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  function changeFilter(next: FilterKey) {
    setFilter(next)
    setPage(1)
  }

  function changePageSize(size: number) {
    setPageSize(size)
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
          icon={<CircleDot className="h-5 w-5" />}
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
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Task Overview</h2>

        <div className="flex flex-col gap-3">
          <div className="relative min-w-55 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by faculty, work type or task…"
              className="rounded-lg pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = FILTER_COUNTS[f.key]?.(stats)
              return (
                <button
                  key={f.key}
                  onClick={() => changeFilter(f.key)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    filter === f.key
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {f.label}
                  {count != null && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
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
            {debouncedSearch
              ? "No tasks match your search — try a different term."
              : filter === "ALL"
                ? "No faculty has booked you yet. Punch in to become available for bookings."
                : "Nothing in this view — try a different filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className={cn("w-full min-w-200 text-sm", loading && "opacity-60")}>
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Faculty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Your update</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ booking, status }) => (
                  <TaskRow key={booking.id} booking={booking} status={status} onReported={load} />
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={pagination.page}
            pageSize={pageSize}
            total={pagination.total}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={changePageSize}
          />
        </div>
      )}

      {deepLinkBooking && !deepLinkReportOpen && (
        <TaskDetailsDialog
          booking={deepLinkBooking}
          status={deriveStatus(deepLinkBooking, new Date())}
          onClose={closeDeepLink}
          onReport={
            deriveStatus(deepLinkBooking, new Date()) === "IN_PROGRESS"
              ? () => setDeepLinkReportOpen(true)
              : undefined
          }
        />
      )}

      {deepLinkBooking && deepLinkReportOpen && (
        <PaReportDialog
          booking={deepLinkBooking}
          onClose={() => setDeepLinkReportOpen(false)}
          onDone={async () => {
            closeDeepLink()
            await load()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

/** Small badge summarising the PA's self-report state. */
function PaReportBadge({ status }: { status: PaWorkStatus | null }) {
  if (!status) return <span className="text-xs text-slate-400">Not reported</span>
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
        status === "DONE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      )}
    >
      {status === "DONE" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {status === "DONE" ? "Done" : "Not done"}
    </span>
  )
}

function TaskRow({
  booking,
  status,
  onReported,
}: {
  booking: Booking
  status: TaskStatus
  onReported: () => void | Promise<void>
}) {
  const [reportOpen, setReportOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const config = STATUS_CONFIG[status]
  const facultyName = booking.faculty.name || booking.faculty.email
  // Reporting only makes sense once the slot has actually started — an
  // upcoming booking has no work to mark done or not done yet.
  const canReport = status === "IN_PROGRESS"

  return (
    <>
      <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
        {/* Task */}
        <td className="px-4 py-3">
          <button
            onClick={() => setDetailsOpen(true)}
            className="max-w-xs cursor-pointer text-left"
          >
            <p className="truncate font-medium text-slate-900 hover:text-indigo-600">
              {booking.workType ?? "Assigned task"}
            </p>
            <p className="truncate text-xs text-slate-400">
              {booking.task?.trim() || "No description"}
            </p>
          </button>
        </td>

        {/* When */}
        <td className="whitespace-nowrap px-4 py-3">
          <p className="font-medium text-slate-700">{relativeDay(booking.date)}</p>
          <p className="text-xs text-slate-400">
            {format(new Date(booking.startTime), "h:mm a")} – {format(new Date(booking.endTime), "h:mm a")}
          </p>
          <p className="text-xs text-slate-400">Booked {format(new Date(booking.createdAt), "MMM d, yyyy")}</p>
        </td>

        {/* Faculty */}
        <td className="whitespace-nowrap px-4 py-3">
          <div className="flex items-center gap-2.5">
            <EntityAvatar
              name={facultyName}
              fallbackText={facultyName}
              imageUrl={booking.faculty.photoUrl}
              className="h-8 w-8"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{facultyName}</p>
              <a
                href={`mailto:${booking.faculty.email}`}
                className="truncate text-xs text-slate-400 hover:text-indigo-600"
              >
                {booking.faculty.email}
              </a>
            </div>
          </div>
        </td>

        {/* Status */}
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
              config.badge
            )}
          >
            {config.icon}
            {config.label}
          </span>
          {booking.rating != null && (
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {booking.rating}/5
            </span>
          )}
        </td>

        {/* PA report */}
        <td className="whitespace-nowrap px-4 py-3">
          <PaReportBadge status={booking.paStatus} />
        </td>

        {/* Action */}
        <td className="whitespace-nowrap px-4 py-3 text-right">
          {canReport ? (
            <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="cursor-pointer">
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
              {booking.paStatus ? "Update" : "Mark"}
            </Button>
          ) : (
            <button
              onClick={() => setDetailsOpen(true)}
              className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline"
            >
              View
            </button>
          )}
        </td>
      </tr>

      {reportOpen && (
        <PaReportDialog
          booking={booking}
          onClose={() => setReportOpen(false)}
          onDone={async () => {
            setReportOpen(false)
            await onReported()
          }}
        />
      )}

      {detailsOpen && (
        <TaskDetailsDialog
          booking={booking}
          status={status}
          onClose={() => setDetailsOpen(false)}
          onReport={canReport ? () => {
            setDetailsOpen(false)
            setReportOpen(true)
          } : undefined}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Read-only task details (opened from a row)
// ---------------------------------------------------------------------------

function TaskDetailsDialog({
  booking,
  status,
  onClose,
  onReport,
}: {
  booking: Booking
  status: TaskStatus
  onClose: () => void
  onReport?: () => void
}) {
  // The booking can still be cancelled/rescheduled by faculty any time it's
  // open — even before it starts — separately from whether reporting is
  // available (only once work has begun).
  const isBookingOpen = booking.status === "BOOKED"
  const config = STATUS_CONFIG[status]
  const facultyName = booking.faculty.name || booking.faculty.email

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{booking.workType ?? "Assigned task"}</DialogTitle>
          <DialogDescription>
            {relativeDay(booking.date)} · {format(new Date(booking.startTime), "h:mm a")} –{" "}
            {format(new Date(booking.endTime), "h:mm a")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                config.badge
              )}
            >
              {config.icon}
              {config.label}
            </span>
            <PaReportBadge status={booking.paStatus} />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
              {booking.task?.trim() || <span className="italic text-slate-400">No description provided.</span>}
            </p>
          </div>

          {booking.paRemark && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Your remark</p>
              <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs italic text-slate-600">
                &ldquo;{booking.paRemark}&rdquo;
              </p>
            </div>
          )}

          <div className="flex items-center gap-2.5 border-t border-slate-100 pt-3">
            <EntityAvatar
              name={facultyName}
              fallbackText={facultyName}
              imageUrl={booking.faculty.photoUrl}
              className="h-9 w-9"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{facultyName}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-slate-400">
                <GraduationCap className="h-3.5 w-3.5 shrink-0" /> {booking.department?.name ?? "Faculty"}
              </p>
            </div>
            <a
              href={`mailto:${booking.faculty.email}`}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </a>
          </div>

          {isBookingOpen && (
            <div className="flex items-start gap-2 rounded-lg bg-indigo-50/60 px-3 py-2 text-xs leading-relaxed text-indigo-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <span>Need to cancel or reschedule? Contact the faculty — only they can change a booking.</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" className="cursor-pointer" onClick={onClose}>
            Close
          </Button>
          {onReport && (
            <Button className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700" onClick={onReport}>
              <ClipboardCheck className="mr-1.5 h-4 w-4" /> Report work
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// PA self-report dialog — "did you carry out this work?"
// ---------------------------------------------------------------------------

function PaReportDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [done, setDone] = useState<boolean | null>(booking.paStatus ? booking.paStatus === "DONE" : null)
  const [remark, setRemark] = useState(booking.paRemark ?? "")
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (done === null) return toast.error("Choose whether the work is done.")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PA_REPORT", done, remark: remark.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Failed to save (${res.status})`)
      toast.success("Your update was sent to the faculty.")
      await onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Report your work</DialogTitle>
          <DialogDescription>
            Let the faculty know whether you carried out this booking. They&apos;ll make the final call
            on closing it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDone(true)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors",
              done === true
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-slate-200 text-slate-600 hover:border-emerald-300"
            )}
          >
            <CheckCircle2 className="h-5 w-5" />
            Work done
          </button>
          <button
            type="button"
            onClick={() => setDone(false)}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors",
              done === false
                ? "border-amber-500 bg-amber-50 text-amber-700"
                : "border-slate-200 text-slate-600 hover:border-amber-300"
            )}
          >
            <XCircle className="h-5 w-5" />
            Not done
          </button>
        </div>

        <div>
          <label htmlFor="pa-remark" className="text-xs font-medium text-slate-600">
            Remark <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="pa-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="Anything the faculty should know…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Send update"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
