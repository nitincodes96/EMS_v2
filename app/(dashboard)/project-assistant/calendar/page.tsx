"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns"
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  PartyPopper,
  Plane,
  UserX,
} from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EntryType = "TASK" | "COMPLETED" | "ABSENT" | "CANCELLED" | "LEAVE" | "HOLIDAY"

type DayEntry = {
  id: string
  time: string
  title: string
  subtitle: string
  type: EntryType
}

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  faculty: { name: string | null; username: string }
}

type Leave = {
  id: string
  reason: string | null
  startDate: string
  endDate: string
  status: "PENDING" | "APPROVED" | "REJECTED"
}

type Holiday = { id: string; name: string; date: string; type: string }

const TYPE_CHIP: Record<EntryType, string> = {
  TASK: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ABSENT: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  LEAVE: "bg-violet-50 text-violet-700",
  HOLIDAY: "bg-amber-50 text-amber-700",
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

export default function CalendarPage() {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const [bookings, setBookings] = useState<Booking[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bookingsRes, leavesRes, deptRes] = await Promise.all([
        fetch("/api/bookings"),
        fetch("/api/leaves"),
        fetch("/api/departments/me"),
      ])

      if (bookingsRes.ok) {
        const d = await bookingsRes.json()
        setBookings(d.bookings ?? [])
      }
      if (leavesRes.ok) {
        const d = await leavesRes.json()
        setLeaves(d.leaves ?? [])
      }
      if (deptRes.ok) {
        const d = await deptRes.json()
        setHolidays(d.department?.holidays ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return { days: eachDayOfInterval({ start, end }), leadingBlanks: getDay(start) }
  }, [month])

  // Bookings, leave days and holidays collapsed into per-day entries
  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {}
    const push = (key: string, entry: DayEntry) => {
      ;(map[key] ??= []).push(entry)
    }

    for (const h of holidays) {
      push(dayKey(new Date(h.date)), {
        id: `hol-${h.id}`,
        time: "All day",
        title: h.name,
        subtitle: "Department holiday",
        type: "HOLIDAY",
      })
    }

    for (const l of leaves) {
      if (l.status === "REJECTED") continue
      const days = eachDayOfInterval({ start: new Date(l.startDate), end: new Date(l.endDate) })
      for (const d of days) {
        push(dayKey(d), {
          id: `leave-${l.id}-${dayKey(d)}`,
          time: "All day",
          title: l.reason || "Leave",
          subtitle: l.status === "PENDING" ? "Awaiting approval" : "Approved leave",
          type: "LEAVE",
        })
      }
    }

    for (const b of bookings) {
      const type: EntryType =
        b.status === "COMPLETED"
          ? "COMPLETED"
          : b.status === "ABSENT"
            ? "ABSENT"
            : b.status === "CANCELLED"
              ? "CANCELLED"
              : "TASK"
      push(dayKey(new Date(b.date)), {
        id: b.id,
        time: format(new Date(b.startTime), "h:mm a"),
        title: b.workType ?? "Assigned task",
        subtitle: `${b.faculty.name || b.faculty.username} · ${format(new Date(b.startTime), "h:mm a")}–${format(
          new Date(b.endTime),
          "h:mm a"
        )}`,
        type,
      })
    }

    // Keep each day ordered: all-day items first, then by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const aAll = a.time === "All day" ? 0 : 1
        const bAll = b.time === "All day" ? 0 : 1
        return aAll - bAll || a.time.localeCompare(b.time)
      })
    }
    return map
  }, [bookings, leaves, holidays])

  const selectedEntries = entriesByDay[dayKey(selectedDay)] ?? []

  const monthCount = useMemo(
    () =>
      Object.entries(entriesByDay)
        .filter(([key]) => isSameMonth(new Date(`${key}T00:00:00`), month))
        .reduce((n, [, list]) => n + list.length, 0),
    [entriesByDay, month]
  )

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{format(month, "MMMM yyyy")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading your schedule…" : `${monthCount} entr${monthCount === 1 ? "y" : "ies"} this month`}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="cursor-pointer rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setMonth(new Date())
              setSelectedDay(new Date())
            }}
            className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="cursor-pointer rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Month grid */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-7", loading && "opacity-50")}>
            {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40" />
            ))}

            {calendarDays.days.map((day) => {
              const entries = entriesByDay[dayKey(day)] ?? []
              const selected = isSameDay(day, selectedDay)
              const visible = entries.slice(0, 2)
              const overflow = entries.length - visible.length

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-24 cursor-pointer border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-indigo-50/40",
                    selected && "bg-indigo-50 ring-2 ring-inset ring-indigo-500"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) && !selected && "bg-indigo-600 text-white",
                      selected && !isToday(day) && "font-semibold text-indigo-700",
                      !isToday(day) && !selected && "text-slate-600"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  <div className="mt-1 space-y-1">
                    {visible.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn("truncate rounded px-1.5 py-0.5 text-[10px] font-medium", TYPE_CHIP[entry.type])}
                      >
                        {entry.title}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="px-1.5 text-[10px] font-medium text-slate-400">+{overflow} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{format(selectedDay, "MMMM d, yyyy")}</h2>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                Selected day details
              </p>
            </div>

            {/* Key indicators */}
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Key indicators</p>
              <div className="mt-2.5 space-y-2">
                <Legend dot="bg-indigo-500" label="Assigned tasks" />
                <Legend dot="bg-emerald-500" label="Completed" />
                <Legend dot="bg-violet-500" label="Leave" />
                <Legend dot="bg-amber-500" label="Holiday" />
              </div>
            </div>

            {/* Daily agenda */}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Daily agenda</p>
              <div className="mt-2.5 space-y-2">
                {selectedEntries.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                    <CalendarDays className="h-4 w-4" /> No entries for this day.
                  </div>
                ) : (
                  selectedEntries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-indigo-500">{entry.time}</p>
                          <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{entry.title}</p>
                          <p className="truncate text-xs text-slate-500">{entry.subtitle}</p>
                        </div>
                        <EntryIcon type={entry.type} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EntryIcon({ type }: { type: EntryType }) {
  const cls = "h-4 w-4 shrink-0"
  if (type === "COMPLETED") return <CheckCircle2 className={cn(cls, "text-emerald-500")} />
  if (type === "ABSENT") return <UserX className={cn(cls, "text-red-500")} />
  if (type === "CANCELLED") return <Ban className={cn(cls, "text-slate-400")} />
  if (type === "LEAVE") return <Plane className={cn(cls, "text-violet-500")} />
  if (type === "HOLIDAY") return <PartyPopper className={cn(cls, "text-amber-500")} />
  return <Circle className={cn(cls, "text-slate-300")} />
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </div>
  )
}
