"use client"

import { useCallback, useEffect, useState } from "react"
import { format, isToday } from "date-fns"
import { CalendarClock, ClipboardList, User } from "lucide-react"

import { cn } from "@/lib/utils"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  faculty: { id: string; name: string | null; username: string; email: string }
  department: { id: string; name: string }
}

const STATUS_STYLES: Record<Booking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  ABSENT: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
}

export default function PATasksPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/bookings")
      const data = await res.json()
      if (res.ok) setBookings(data.bookings ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = bookings.filter((b) => isToday(new Date(b.date)))
  const upcoming = bookings.filter((b) => new Date(b.date) > new Date() && !isToday(new Date(b.date)))
  const past = bookings.filter((b) => new Date(b.date) < new Date() && !isToday(new Date(b.date)))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Check in from Attendance to become bookable. Tasks assigned by faculty appear here.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <CalendarClock className="h-4 w-4 text-indigo-600" /> Today&apos;s tasks
        </h2>
        <div className="mt-4 space-y-3">
          {today.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No tasks booked for today.</p>
          ) : (
            today.map((b) => <TaskRow key={b.id} booking={b} />)
          )}
        </div>
      </div>

      <Section title="Upcoming" items={upcoming} loading={loading} />
      <Section title="Past" items={past} loading={loading} />
    </div>
  )
}

function Section({ title, items, loading }: { title: string; items: Booking[]; loading: boolean }) {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <ClipboardList className="h-4 w-4 text-indigo-600" /> {title}
      </h2>
      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nothing here.</p>
        ) : (
          items.map((b) => <TaskRow key={b.id} booking={b} />)
        )}
      </div>
    </div>
  )
}

function TaskRow({ booking }: { booking: Booking }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <User className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{booking.task}</p>
        <p className="text-xs text-slate-500">
          {booking.faculty.name || booking.faculty.username} ·{" "}
          {format(new Date(booking.date), "MMM d")} ·{" "}
          {format(new Date(booking.startTime), "h:mm a")}–{format(new Date(booking.endTime), "h:mm a")}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          STATUS_STYLES[booking.status]
        )}
      >
        {booking.status}
      </span>
    </div>
  )
}
