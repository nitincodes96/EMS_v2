"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { format, differenceInMinutes } from "date-fns"
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  FileText,
  History,
  Info,
  Phone,
  Star,
  Tag,
  Timer,
  UserRound,
  UserX,
  X,
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
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { WORK_TYPES } from "@/lib/work-types"
import { buildHourlySlots, minutesToHHMM, minutesToLabel, parseHHMM, type Slot } from "@/lib/booking-slots"
import { cn } from "@/lib/utils"

type LogAction = "CREATED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED" | "MARKED_ABSENT" | "RATED"

type BookingLog = {
  id: string
  action: LogAction
  message: string
  remark: string | null
  createdAt: string
  actor: { id: string; name: string | null; username: string } | null
}

type BookingDetail = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  rating: number | null
  ratedAt: string | null
  createdAt: string
  updatedAt: string
  pa: {
    id: string
    name: string | null
    username: string
    email: string
    phoneNumber: string | null
    photoUrl: string | null
  }
  faculty: { id: string; name: string | null; username: string; email: string }
  department: { id: string; name: string } | null
  logs: BookingLog[]
}

type SlotsResponse = {
  bookingWindow: { start: string; end: string; enabled: boolean }
  dayUnavailable: boolean
  dayUnavailableReason: string | null
  booked: { id: string; start: string; end: string; status: string }[]
}

type OutcomeStatus = "COMPLETED" | "ABSENT" | "CANCELLED"

const STATUS_STYLES: Record<BookingDetail["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ABSENT: "bg-red-50 text-red-700 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
}

const LOG_STYLES: Record<LogAction, string> = {
  CREATED: "bg-indigo-50 text-indigo-600",
  RESCHEDULED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  MARKED_ABSENT: "bg-red-50 text-red-600",
  RATED: "bg-yellow-50 text-yellow-700",
}

const LOG_LABELS: Record<LogAction, string> = {
  CREATED: "Created",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  MARKED_ABSENT: "Marked absent",
  RATED: "Rated",
}

const OUTCOME_COPY: Record<
  OutcomeStatus,
  { title: string; description: string; confirm: string; tone: string }
> = {
  COMPLETED: {
    title: "Mark booking as completed",
    description: "Confirm the PA carried out this slot. Add an optional remark for the record.",
    confirm: "Mark completed",
    tone: "bg-emerald-600 hover:bg-emerald-700",
  },
  ABSENT: {
    title: "Mark PA absent",
    description: "The PA did not report for this slot. Add an optional remark — it's shared with them.",
    confirm: "Mark absent",
    tone: "bg-red-600 hover:bg-red-700",
  },
  CANCELLED: {
    title: "Cancel this booking",
    description: "The slot will be released and the PA notified. Add an optional reason.",
    confirm: "Cancel booking",
    tone: "bg-red-600 hover:bg-red-700",
  },
}

/** Read-only star display. */
function StarDisplay({ value, size = "sm" }: { value: number; size?: "sm" | "md" }) {
  const px = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5"
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(px, n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300")}
        />
      ))}
    </span>
  )
}

/** Interactive 1–5 star picker. */
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="mt-1 flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="cursor-pointer rounded p-0.5 transition-transform hover:scale-110"
          aria-label={`Rate ${n} out of 5`}
        >
          <Star className={cn("h-6 w-6", n <= active ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
        </button>
      ))}
      {value > 0 && <span className="ml-1.5 text-xs font-medium text-slate-500">{value}/5</span>}
    </div>
  )
}

/** Parse a response body that may be empty or non-JSON (e.g. a crashed route). */
async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>()
  const bookingId = params.id

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [canChange, setCanChange] = useState(false)
  const [canRecordOutcome, setCanRecordOutcome] = useState(false)
  const [cutoffMinutes, setCutoffMinutes] = useState(60)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [outcome, setOutcome] = useState<OutcomeStatus | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`)
      const json = await safeJson(res)
      if (!res.ok || !json?.booking) {
        setNotFound(true)
        toast.error((json?.error as string) || `Could not load booking (${res.status})`)
        return
      }
      const rules = (json.rules ?? {}) as {
        canChange?: boolean
        canRecordOutcome?: boolean
        cutoffMinutes?: number
      }
      setBooking(json.booking as BookingDetail)
      setCanChange(Boolean(rules.canChange))
      setCanRecordOutcome(Boolean(rules.canRecordOutcome))
      setCutoffMinutes(rules.cutoffMinutes ?? 60)
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    void load()
  }, [load])

  async function submitOutcome(status: OutcomeStatus, remark: string, rating?: number) {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          remark: remark.trim() || undefined,
          rating: status === "COMPLETED" && rating ? rating : undefined,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error((json?.error as string) || `Failed to update booking (${res.status})`)
      toast.success(
        status === "CANCELLED"
          ? "Booking cancelled."
          : status === "COMPLETED"
            ? "Marked completed."
            : "PA marked absent."
      )
      setOutcome(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update booking")
    } finally {
      setBusy(false)
    }
  }

  async function submitRating(rating: number, remark: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RATE", rating, remark: remark.trim() || undefined }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error((json?.error as string) || `Failed to save rating (${res.status})`)
      toast.success("Rating saved.")
      setRatingOpen(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save rating")
    } finally {
      setBusy(false)
    }
  }

  if (loading && !booking) {
    return <p className="py-16 text-center text-sm text-slate-400">Loading booking…</p>
  }

  if (notFound || !booking) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">Booking not found</p>
        <Link href="/faculty/bookings" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
          Back to bookings
        </Link>
      </div>
    )
  }

  const isActive = booking.status === "BOOKED"
  const start = new Date(booking.startTime)
  const end = new Date(booking.endTime)
  const hours = Math.max(1, Math.round(differenceInMinutes(end, start) / 60))

  return (
    <div>
      <Link
        href="/faculty/bookings"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* Hero */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-4 p-5">
              <EntityAvatar
                name={booking.pa.name || booking.pa.username}
                fallbackText={booking.pa.name || booking.pa.username}
                imageUrl={booking.pa.photoUrl}
                className="h-14 w-14"
              />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
                  {booking.pa.name || booking.pa.username}
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
                {booking.rating != null && <StarDisplay value={booking.rating} size="md" />}
              </div>
            </div>

            {/* Key facts strip */}
            <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
              <Fact icon={<CalendarDays className="h-4 w-4" />} label="Date" value={format(new Date(booking.date), "MMM d, yyyy")} />
              <Fact
                icon={<Clock className="h-4 w-4" />}
                label="Slot"
                value={`${format(start, "h:mm a")} – ${format(end, "h:mm a")}`}
              />
              <Fact icon={<Timer className="h-4 w-4" />} label="Duration" value={`${hours} hour${hours > 1 ? "s" : ""}`} />
              <Fact icon={<Tag className="h-4 w-4" />} label="Work type" value={booking.workType ?? "—"} />
            </div>
          </div>

          {/* Booking details */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <FileText className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Booking details</h2>
            </div>

            <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
              <Detail
                icon={<UserRound className="h-3.5 w-3.5" />}
                label="Booked by"
                value={booking.faculty.name || booking.faculty.username}
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
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{booking.task}</p>
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
                        {log.actor ? log.actor.name || log.actor.username : "System"} ·{" "}
                        {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Actions</h2>

            {booking.status === "COMPLETED" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    PA rating
                  </p>
                  {booking.rating != null ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <StarDisplay value={booking.rating} size="md" />
                      <span className="text-sm font-medium text-slate-700">{booking.rating}/5</span>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">Not rated yet.</p>
                  )}
                  {booking.ratedAt && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Rated {format(new Date(booking.ratedAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRatingOpen(true)}
                  className="w-full cursor-pointer justify-start text-amber-600 hover:bg-amber-50"
                >
                  <Star className="mr-2 h-4 w-4" />
                  {booking.rating != null ? "Update rating" : "Rate this PA"}
                </Button>
              </div>
            ) : !isActive ? (
              <div className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                This booking is {booking.status.toLowerCase()} — no further changes can be made.
              </div>
            ) : (
              <div className="mt-4 space-y-5">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Record outcome</p>
                  <Button
                    variant="outline"
                    disabled={busy || !canRecordOutcome}
                    onClick={() => setOutcome("COMPLETED")}
                    className="w-full cursor-pointer justify-start text-emerald-700 hover:bg-emerald-50"
                  >
                    <Check className="mr-2 h-4 w-4" /> Mark completed
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !canRecordOutcome}
                    onClick={() => setOutcome("ABSENT")}
                    className="w-full cursor-pointer justify-start text-red-600 hover:bg-red-50"
                  >
                    <UserX className="mr-2 h-4 w-4" /> Mark PA absent
                  </Button>

                  {!canRecordOutcome && (
                    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
                      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                      <span>
                        Available once the slot starts at{" "}
                        <strong className="font-semibold">{format(start, "h:mm a")}</strong> on{" "}
                        {format(new Date(booking.date), "MMM d")}.
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Change booking</p>
                  <Button
                    variant="outline"
                    disabled={busy || !canChange}
                    onClick={() => setRescheduleOpen(true)}
                    className="w-full cursor-pointer justify-start"
                  >
                    <CalendarClock className="mr-2 h-4 w-4" /> Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !canChange}
                    onClick={() => setOutcome("CANCELLED")}
                    className="w-full cursor-pointer justify-start text-red-600 hover:bg-red-50"
                  >
                    <X className="mr-2 h-4 w-4" /> Cancel booking
                  </Button>

                  <div
                    className={cn(
                      "flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed",
                      canChange ? "bg-slate-50 text-slate-500" : "bg-amber-50 text-amber-700"
                    )}
                  >
                    <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                    {canChange ? (
                      <span>
                        Can be cancelled or rescheduled until{" "}
                        <strong className="font-semibold">1 hour before</strong> the start time.
                      </span>
                    ) : (
                      <span>
                        Cancellation window closed — under {cutoffMinutes} minutes to start time.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {outcome && (
        <OutcomeDialog
          status={outcome}
          busy={busy}
          onClose={() => setOutcome(null)}
          onConfirm={(remark, rating) => submitOutcome(outcome, remark, rating)}
        />
      )}

      {ratingOpen && (
        <RatingDialog
          paName={booking.pa.name || booking.pa.username}
          initialRating={booking.rating ?? 0}
          busy={busy}
          onClose={() => setRatingOpen(false)}
          onConfirm={submitRating}
        />
      )}

      <RescheduleDialog
        open={rescheduleOpen}
        booking={booking}
        onClose={() => setRescheduleOpen(false)}
        onDone={async () => {
          setRescheduleOpen(false)
          await load()
        }}
      />
    </div>
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

// ---------------------------------------------------------------------------
// Outcome dialog (complete / absent / cancel) with optional remark
// ---------------------------------------------------------------------------

function OutcomeDialog({
  status,
  busy,
  onClose,
  onConfirm,
}: {
  status: OutcomeStatus
  busy: boolean
  onClose: () => void
  onConfirm: (remark: string, rating?: number) => void
}) {
  const [remark, setRemark] = useState("")
  const [rating, setRating] = useState(0)
  const copy = OUTCOME_COPY[status]

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {status === "COMPLETED" && (
          <div>
            <label className="text-xs font-medium text-slate-600">
              Rate this PA <span className="text-slate-400">(optional)</span>
            </label>
            <StarPicker value={rating} onChange={setRating} />
          </div>
        )}

        <div>
          <label htmlFor="outcome-remark" className="text-xs font-medium text-slate-600">
            Remarks <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="outcome-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="Add a note for the record…"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            className={cn("flex-1 cursor-pointer text-white", copy.tone)}
            onClick={() => onConfirm(remark, rating || undefined)}
            disabled={busy}
          >
            {busy ? "Saving…" : copy.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Rating dialog for an already-completed booking
// ---------------------------------------------------------------------------

function RatingDialog({
  paName,
  initialRating,
  busy,
  onClose,
  onConfirm,
}: {
  paName: string
  initialRating: number
  busy: boolean
  onClose: () => void
  onConfirm: (rating: number, remark: string) => void
}) {
  const [rating, setRating] = useState(initialRating)
  const [remark, setRemark] = useState("")

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Rate {paName}</DialogTitle>
          <DialogDescription>
            How was the PA&apos;s work on this booking? Rate out of 5 stars.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="text-xs font-medium text-slate-600">Rating</label>
          <StarPicker value={rating} onChange={setRating} />
        </div>

        <div>
          <label htmlFor="rating-remark" className="text-xs font-medium text-slate-600">
            Remarks <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            id="rating-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="What went well, or what could improve?"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button
            className="flex-1 cursor-pointer bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => onConfirm(rating, remark)}
            disabled={busy || rating < 1}
          >
            {busy ? "Saving…" : "Save rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Reschedule dialog: new date + continuous slots + remark
// ---------------------------------------------------------------------------

function RescheduleDialog({
  open,
  booking,
  onClose,
  onDone,
}: {
  open: boolean
  booking: BookingDetail
  onClose: () => void
  onDone: () => void
}) {
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [date, setDate] = useState(() => format(new Date(booking.date), "yyyy-MM-dd"))
  const [data, setData] = useState<SlotsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [workType, setWorkType] = useState(booking.workType ?? "")
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setSelected([])
    try {
      const res = await fetch(
        `/api/bookings/slots?paId=${booking.pa.id}&date=${date}&excludeBookingId=${booking.id}`
      )
      const json = await safeJson(res)
      if (res.ok && json) setData(json as unknown as SlotsResponse)
      else {
        setData(null)
        toast.error((json?.error as string) || `Failed to load availability (${res.status})`)
      }
    } finally {
      setLoading(false)
    }
  }, [booking.pa.id, booking.id, date, open])

  useEffect(() => {
    void load()
  }, [load])

  const slots = useMemo<Slot[]>(
    () => (data ? buildHourlySlots(data.bookingWindow.start, data.bookingWindow.end) : []),
    [data]
  )

  const bookedRanges = useMemo(
    () => (data?.booked ?? []).map((b) => ({ startMin: parseHHMM(b.start), endMin: parseHHMM(b.end) })),
    [data]
  )

  const isToday = date === todayStr
  const nowMin = useMemo(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [])

  const dayBlocked = data?.dayUnavailable ?? false
  const bookingDisabled = data ? !data.bookingWindow.enabled : false

  const slotState = useCallback(
    (slot: Slot): "available" | "booked" | "past" => {
      if (bookedRanges.some((b) => b.startMin < slot.endMin && b.endMin > slot.startMin)) return "booked"
      if (isToday && slot.startMin <= nowMin) return "past"
      return "available"
    },
    [bookedRanges, isToday, nowMin]
  )

  const isSelectable = useCallback(
    (i: number) => !bookingDisabled && !dayBlocked && slotState(slots[i]) === "available",
    [bookingDisabled, dayBlocked, slotState, slots]
  )

  function range(a: number, b: number) {
    const out: number[] = []
    for (let i = a; i <= b; i++) out.push(i)
    return out
  }

  function allSelectable(lo: number, hi: number) {
    for (let i = lo; i <= hi; i++) if (!isSelectable(i)) return false
    return true
  }

  function toggleSlot(i: number) {
    if (!isSelectable(i)) return
    if (selected.length === 0) return setSelected([i])
    const min = selected[0]
    const max = selected[selected.length - 1]
    if (i >= min && i <= max) {
      if (i === min && i === max) setSelected([])
      else if (i === min) setSelected(range(min + 1, max))
      else if (i === max) setSelected(range(min, max - 1))
      else setSelected([i])
      return
    }
    const lo = Math.min(min, i)
    const hi = Math.max(max, i)
    if (allSelectable(lo, hi)) setSelected(range(lo, hi))
    else setSelected([i])
  }

  const hasSelection = selected.length > 0
  const selStart = hasSelection ? slots[selected[0]].startMin : null
  const selEnd = hasSelection ? slots[selected[selected.length - 1]].endMin : null

  async function submit() {
    if (!hasSelection || selStart == null || selEnd == null) return toast.error("Select the new time slot.")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESCHEDULE",
          date,
          startTime: minutesToHHMM(selStart),
          endTime: minutesToHHMM(selEnd),
          workType: workType || undefined,
          remark: remark.trim() || undefined,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error((json?.error as string) || `Failed to reschedule (${res.status})`)
      toast.success("Booking rescheduled.")
      setRemark("")
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reschedule")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Reschedule booking</DialogTitle>
          <DialogDescription>
            Pick a new day and continuous slots for {booking.pa.name || booking.pa.username}. The current
            slot is shown as free.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="reschedule-date" className="text-xs font-medium text-slate-600">
              New date
            </label>
            <input
              id="reschedule-date"
              type="date"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600">Time slots</p>
            {loading ? (
              <p className="py-6 text-center text-sm text-slate-400">Loading availability…</p>
            ) : bookingDisabled ? (
              <div className="mt-1 rounded-lg bg-amber-50 px-3 py-3 text-center text-sm text-amber-700">
                Booking is disabled for this department.
              </div>
            ) : dayBlocked ? (
              <div className="mt-1 rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
                {data?.dayUnavailableReason || "PA is unavailable on this day."}
              </div>
            ) : slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No bookable hours in the window.</p>
            ) : (
              <>
                <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot, i) => {
                    const state = slotState(slot)
                    const isSel = selected.includes(i)
                    const disabled = state !== "available"
                    return (
                      <button
                        key={slot.startMin}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleSlot(i)}
                        title={
                          state === "booked" ? "Already booked" : state === "past" ? "Time has passed" : undefined
                        }
                        className={cn(
                          "rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
                          isSel
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : disabled
                              ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 line-through"
                              : "cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                        )}
                      >
                        {minutesToLabel(slot.startMin)}
                      </button>
                    )
                  })}
                </div>
                {hasSelection && selStart != null && selEnd != null && (
                  <p className="mt-2.5 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                    New slot: {minutesToLabel(selStart)} – {minutesToLabel(selEnd)} ({selected.length} hr
                    {selected.length > 1 ? "s" : ""})
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="reschedule-worktype" className="text-xs font-medium text-slate-600">
              Work type
            </label>
            <select
              id="reschedule-worktype"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="mt-1 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Keep current</option>
              {WORK_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reschedule-remark" className="text-xs font-medium text-slate-600">
              Remarks <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="reschedule-remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              placeholder="Why is this being rescheduled?"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={submitting}>
              Back
            </Button>
            <Button
              className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              onClick={submit}
              disabled={submitting || !hasSelection}
            >
              {submitting ? "Saving…" : "Confirm reschedule"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
