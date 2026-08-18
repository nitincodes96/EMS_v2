"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { differenceInMinutes, format } from "date-fns"
import { toast } from "react-hot-toast"
import {
  ArrowLeft,
  Ban,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  History,
  Phone,
  ShieldAlert,
  Star,
  Tag,
  Timer,
  UserRound,
  UserX,
  X,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type LogAction =
  | "CREATED"
  | "RESCHEDULED"
  | "CANCELLED"
  | "COMPLETED"
  | "MARKED_ABSENT"
  | "MARKED_INCOMPLETE"
  | "RATED"
  | "PA_REPORTED"

type BookingLog = {
  id: string
  action: LogAction
  message: string
  remark: string | null
  createdAt: string
  actor: { id: string; name: string | null } | null
}

type BookingDetail = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"
  rating: number | null
  ratedAt: string | null
  paStatus: "DONE" | "NOT_DONE" | null
  paRemark: string | null
  paMarkedAt: string | null
  createdAt: string
  updatedAt: string
  pa: {
    id: string
    name: string | null
    email: string
    phoneNumber: string | null
    photoUrl: string | null
  }
  faculty: { id: string; name: string | null; email: string }
  department: { id: string; name: string } | null
  logs: BookingLog[]
}

const STATUS_STYLES: Record<BookingDetail["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  INCOMPLETE: "bg-amber-50 text-amber-700 ring-amber-200",
  ABSENT: "bg-red-50 text-red-700 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
}

const LOG_STYLES: Record<LogAction, string> = {
  CREATED: "bg-indigo-50 text-indigo-600",
  RESCHEDULED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  MARKED_ABSENT: "bg-red-50 text-red-600",
  MARKED_INCOMPLETE: "bg-amber-50 text-amber-700",
  RATED: "bg-yellow-50 text-yellow-700",
  PA_REPORTED: "bg-sky-50 text-sky-700",
}

const LOG_LABELS: Record<LogAction, string> = {
  CREATED: "Created",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  MARKED_ABSENT: "Marked absent",
  MARKED_INCOMPLETE: "Marked not completed",
  RATED: "Rated",
  PA_REPORTED: "PA update",
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>()
  const bookingId = params.id

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`)
      const json = await safeJson(res)
      if (!res.ok || !json?.booking) {
        setNotFound(true)
        return
      }
      setBooking(json.booking as BookingDetail)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !booking) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading booking…</p>
  }

  if (notFound || !booking) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">Booking not found</p>
        <Link href="/admin/bookings" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
          Back to bookings
        </Link>
      </div>
    )
  }

  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  const hours = Math.max(1, Math.round(differenceInMinutes(end, start) / 60))

  return (
    <div>
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <div className="mt-4 space-y-6">
        {/* Hero */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4 p-5">
            <EntityAvatar
              name={booking.pa.name}
              fallbackText={booking.pa.email}
              imageUrl={booking.pa.photoUrl}
              className="h-14 w-14"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
                {booking.pa.name || booking.pa.email}
              </h1>
              <p className="truncate text-sm text-slate-500">{booking.pa.email}</p>
              {booking.pa.phoneNumber && (
                <a
                  href={`tel:${booking.pa.phoneNumber}`}
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" /> {booking.pa.phoneNumber}
                </a>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1",
                  STATUS_STYLES[booking.status]
                )}
              >
                {booking.status}
              </span>
              {booking.rating != null && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-700">{booking.rating}/5</span>
                </span>
              )}
              {booking.status === "BOOKED" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setCloseOpen(true)}
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Close booking
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
            <Fact
              icon={<CalendarDays className="h-4 w-4" />}
              label="Date"
              value={format(new Date(booking.date), "MMM d, yyyy")}
            />
            <Fact
              icon={<Clock className="h-4 w-4" />}
              label="Slot"
              value={`${format(start, "h:mm a")} – ${format(end, "h:mm a")}`}
            />
            <Fact icon={<Timer className="h-4 w-4" />} label="Duration" value={`${hours} hour${hours > 1 ? "s" : ""}`} />
            <Fact icon={<Tag className="h-4 w-4" />} label="Work type" value={booking.workType ?? "—"} />
          </div>
        </div>

        {/* Details */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <FileText className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900">Booking details</h2>
          </div>

          <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
            <Detail
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="Booked by"
              value={booking.faculty.name || booking.faculty.email}
              hint={booking.faculty.email}
            />
            <Detail
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Department"
              value={booking.department?.name ?? "—"}
            />
            <Detail
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Created"
              value={format(new Date(booking.createdAt), "MMM d, yyyy")}
              hint={format(new Date(booking.createdAt), "h:mm a")}
            />
            <Detail
              icon={<History className="h-3.5 w-3.5" />}
              label="Last updated"
              value={format(new Date(booking.updatedAt), "MMM d, yyyy")}
              hint={format(new Date(booking.updatedAt), "h:mm a")}
            />
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {booking.task?.trim() ? booking.task : <span className="text-slate-400">No description provided.</span>}
            </p>
          </div>
        </div>

        {/* PA's report */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ClipboardCheck className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900">PA&apos;s report</h2>
          </div>
          <div className="px-5 py-4">
            {booking.paStatus ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase",
                      booking.paStatus === "DONE"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {booking.paStatus === "DONE" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    {booking.paStatus === "DONE" ? "Marked done" : "Marked not done"}
                  </span>
                  {booking.paMarkedAt && (
                    <span className="text-xs text-slate-400">
                      {format(new Date(booking.paMarkedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  )}
                </div>
                {booking.paRemark && (
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
                    &ldquo;{booking.paRemark}&rdquo;
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">The PA hasn&apos;t reported on this work yet.</p>
            )}
          </div>
        </div>

        {/* Activity log */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <History className="h-4 w-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-slate-900">Activity log</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {booking.logs.length}
            </span>
          </div>

          {booking.logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {booking.logs.map((log) => (
                <li key={log.id} className="flex gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      LOG_STYLES[log.action]
                    )}
                  >
                    {LOG_LABELS[log.action]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">{log.message}</p>
                    {log.remark && (
                      <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs italic text-slate-600">
                        &ldquo;{log.remark}&rdquo;
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {log.actor ? log.actor.name || "System" : "System"} ·{" "}
                      {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Bookings are managed by the faculty who created them — an admin can only step in to close a stuck
          or forgotten one.
        </p>
      </div>

      {closeOpen && booking && (
        <CloseBookingDialog booking={booking} onClose={() => setCloseOpen(false)} onDone={load} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admin override: close any open booking, with a mandatory remark
// ---------------------------------------------------------------------------

type CloseStatus = "CANCELLED" | "COMPLETED" | "INCOMPLETE" | "ABSENT"

const CLOSE_OPTIONS: { value: CloseStatus; label: string; icon: React.ReactNode; tone: string }[] = [
  { value: "CANCELLED", label: "Cancelled", icon: <Ban className="h-4 w-4" />, tone: "border-slate-300 bg-slate-50 text-slate-700" },
  { value: "COMPLETED", label: "Completed", icon: <CheckCircle2 className="h-4 w-4" />, tone: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { value: "INCOMPLETE", label: "Not completed", icon: <XCircle className="h-4 w-4" />, tone: "border-amber-300 bg-amber-50 text-amber-700" },
  { value: "ABSENT", label: "PA absent", icon: <UserX className="h-4 w-4" />, tone: "border-red-300 bg-red-50 text-red-700" },
]

function CloseBookingDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingDetail
  onClose: () => void
  onDone: () => void | Promise<void>
}) {
  const [status, setStatus] = useState<CloseStatus>("CANCELLED")
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!remark.trim()) return toast.error("A remark is required to close a booking as an admin.")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remark: remark.trim() }),
      })
      const data = await safeJson(res)
      if (!res.ok) throw new Error((data?.error as string) || "Failed to close booking")
      toast.success("Booking closed.")
      onClose()
      await onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close booking")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Close this booking</DialogTitle>
          <DialogDescription>
            This overrides the normal faculty/PA rules — it works even outside the usual cutoff window.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            {booking.faculty.name || booking.faculty.email} and {booking.pa.name || booking.pa.email} will both
            be notified, with your remark, once this is saved.
          </span>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600">Outcome</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {CLOSE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-xs font-semibold transition-colors",
                  status === opt.value ? opt.tone : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                )}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="admin-close-remark" className="text-xs font-medium text-slate-600">
            Remark <span className="text-red-500">*</span>
          </label>
          <textarea
            id="admin-close-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="Why is an admin closing this booking?"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer bg-red-600 text-white hover:bg-red-700"
            onClick={submit}
            disabled={submitting || !remark.trim()}
          >
            {submitting ? "Closing…" : "Close booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-3.5">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function Detail({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="bg-white px-5 py-3.5">
      <div className="flex items-center gap-1.5 text-slate-400">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{value}</p>
      {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
