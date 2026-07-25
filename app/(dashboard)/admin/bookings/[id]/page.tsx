"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { differenceInMinutes, format } from "date-fns"
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  History,
  Phone,
  Star,
  Tag,
  Timer,
  UserRound,
} from "lucide-react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
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
              {booking.rating != null && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-700">{booking.rating}/5</span>
                </span>
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

        <p className="text-xs text-slate-400">
          Read-only view — bookings are managed by the faculty who created them.
        </p>
      </div>
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
