"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isBefore,
  isSameDay,
  isToday,
  startOfMonth,
  startOfToday,
  subMonths,
} from "date-fns"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
} from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { WORK_TYPES } from "@/lib/work-types"
import {
  buildHourlySlots,
  minutesToHHMM,
  minutesToLabel,
  parseHHMM,
  type Slot,
} from "@/lib/booking-slots"
import { cn } from "@/lib/utils"

type PADetail = {
  id: string
  name: string | null
  username: string
  email: string
  photoUrl: string | null
  isAvailable: boolean
  availabilitySince: string | null
  department: { id: string; name: string } | null
}

type MonthBooking = {
  id: string
  date: string
  start: string
  end: string
  workType: string | null
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
}

type MonthHoliday = { id: string; date: string; name: string; type: string }

type MonthResponse = {
  pa: PADetail
  leaveDates: string[]
  bookings: MonthBooking[]
  holidays: MonthHoliday[]
}

type SlotsResponse = {
  bookingWindow: { start: string; end: string; enabled: boolean }
  dayUnavailable: boolean
  dayUnavailableReason: string | null
  booked: { id: string; start: string; end: string; status: string }[]
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

const CHIP = {
  BOOKED: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  LEAVE: "bg-red-50 text-red-700",
  HOLIDAY: "bg-amber-50 text-amber-700",
} as const

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd")
}

export default function BookPACalendarPage() {
  const params = useParams<{ paId: string }>()
  const paId = params.paId

  const [pa, setPa] = useState<PADetail | null>(null)
  const [month, setMonth] = useState(() => new Date())
  const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set())
  const [bookings, setBookings] = useState<MonthBooking[]>([])
  const [holidays, setHolidays] = useState<MonthHoliday[]>([])
  const [loadingMonth, setLoadingMonth] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  const monthParam = format(month, "yyyy-MM")

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true)
    try {
      const res = await fetch(`/api/pas/${paId}?month=${monthParam}`)
      const json = (await res.json()) as MonthResponse & { error?: string }
      if (!res.ok) {
        setNotFound(true)
        toast.error(json?.error || "Could not load PA")
        return
      }
      setPa(json.pa)
      setLeaveDates(new Set(json.leaveDates ?? []))
      setBookings(json.bookings ?? [])
      setHolidays(json.holidays ?? [])
    } finally {
      setLoadingMonth(false)
    }
  }, [paId, monthParam])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  const today = startOfToday()

  const calendar = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    return { days: eachDayOfInterval({ start, end }), leadingBlanks: getDay(start) }
  }, [month])

  const bookingsByDate = useMemo(() => {
    const map: Record<string, MonthBooking[]> = {}
    for (const b of bookings) (map[b.date] ??= []).push(b)
    return map
  }, [bookings])

  const holidayByDate = useMemo(() => {
    const map: Record<string, MonthHoliday> = {}
    for (const h of holidays) map[h.date] = h
    return map
  }, [holidays])

  const selectedKey = dayKey(selectedDay)
  const selectedBookings = bookingsByDate[selectedKey] ?? []
  const selectedHoliday = holidayByDate[selectedKey] ?? null
  const selectedOnLeave = leaveDates.has(selectedKey)

  if (notFound) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">Project Assistant not found</p>
        <Link href="/faculty/book-pa" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">
          Back to PA list
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* PA identity header */}
      <div className="mb-6">
        <Link
          href="/faculty/book-pa"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> All PAs
        </Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <EntityAvatar
              name={pa?.name || pa?.username || "PA"}
              fallbackText={pa?.name || pa?.username || "PA"}
              imageUrl={pa?.photoUrl ?? null}
              className="h-12 w-12"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
                {pa?.name || pa?.username || "Loading…"}
              </h1>
              <p className="truncate text-sm text-slate-500">
                {pa?.department?.name ? `${pa.department.name} · ` : ""}
                {pa?.email}
              </p>
            </div>
            {pa?.isAvailable && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live now
              </span>
            )}
          </div>

          {/* Month nav */}
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
        <p className="mt-3 text-lg font-semibold tracking-tight text-slate-900">{format(month, "MMMM yyyy")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        {/* Month grid */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wider text-slate-400">
                {d}
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-7", loadingMonth && "opacity-50")}>
            {Array.from({ length: calendar.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40" />
            ))}

            {calendar.days.map((day) => {
              const key = dayKey(day)
              const selected = isSameDay(day, selectedDay)
              const past = isBefore(day, today)
              const holiday = holidayByDate[key]
              const onLeave = leaveDates.has(key)
              const dayBookings = bookingsByDate[key] ?? []

              // Chips: holiday, leave, then bookings (max 2 shown)
              const chips: { key: string; label: string; cls: string }[] = []
              if (holiday) chips.push({ key: "hol", label: holiday.name, cls: CHIP.HOLIDAY })
              if (onLeave) chips.push({ key: "leave", label: "On leave", cls: CHIP.LEAVE })
              for (const b of dayBookings) {
                chips.push({
                  key: b.id,
                  label: `${b.start} · ${b.workType ?? "Task"}`,
                  cls: b.status === "COMPLETED" ? CHIP.COMPLETED : CHIP.BOOKED,
                })
              }
              const visible = chips.slice(0, 2)
              const overflow = chips.length - visible.length

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-indigo-50/40 cursor-pointer",
                    selected && "bg-indigo-50 ring-2 ring-inset ring-indigo-500",
                    past && !selected && "bg-slate-50/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday(day) && !selected && "bg-indigo-600 text-white",
                      selected && "font-semibold text-indigo-700",
                      !isToday(day) && !selected && (past ? "text-slate-300" : "text-slate-600")
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  <div className="mt-1 space-y-1">
                    {visible.map((c) => (
                      <div key={c.key} className={cn("truncate rounded px-1.5 py-0.5 text-[10px] font-medium", c.cls)}>
                        {c.label}
                      </div>
                    ))}
                    {overflow > 0 && <div className="px-1.5 text-[10px] font-medium text-slate-400">+{overflow} more</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day: agenda + booking form */}
        <DayPanel
          paId={paId}
          day={selectedDay}
          dayBookings={selectedBookings}
          holiday={selectedHoliday}
          onLeave={selectedOnLeave}
          onBooked={loadMonth}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right panel: selected-day agenda + slot picker + booking form
// ---------------------------------------------------------------------------

function DayPanel({
  paId,
  day,
  dayBookings,
  holiday,
  onLeave,
  onBooked,
}: {
  paId: string
  day: Date
  dayBookings: MonthBooking[]
  holiday: MonthHoliday | null
  onLeave: boolean
  onBooked: () => void
}) {
  const date = format(day, "yyyy-MM-dd")
  const isPast = isBefore(day, startOfToday())

  const [data, setData] = useState<SlotsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [workType, setWorkType] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected([])
    try {
      const res = await fetch(`/api/bookings/slots?paId=${paId}&date=${date}`)
      const json = await res.json()
      if (res.ok) setData(json)
      else {
        setData(null)
        toast.error(json?.error || "Failed to load availability")
      }
    } finally {
      setLoading(false)
    }
  }, [paId, date])

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

  const isTodayDate = date === format(new Date(), "yyyy-MM-dd")
  const nowMin = useMemo(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }, [])

  const bookingDisabled = data ? !data.bookingWindow.enabled : false
  const dayBlocked = (data?.dayUnavailable ?? onLeave) || isPast

  const slotState = useCallback(
    (slot: Slot): "available" | "booked" | "past" => {
      if (bookedRanges.some((b) => b.startMin < slot.endMin && b.endMin > slot.startMin)) return "booked"
      if (isTodayDate && slot.startMin <= nowMin) return "past"
      return "available"
    },
    [bookedRanges, isTodayDate, nowMin]
  )

  const isSelectable = useCallback(
    (i: number) => !bookingDisabled && !dayBlocked && slotState(slots[i]) === "available",
    [bookingDisabled, dayBlocked, slotState, slots]
  )

  function range(a: number, b: number): number[] {
    const out: number[] = []
    for (let i = a; i <= b; i++) out.push(i)
    return out
  }

  function allSelectable(lo: number, hi: number): boolean {
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
    if (!hasSelection || selStart == null || selEnd == null) return toast.error("Select at least one time slot.")
    if (!workType) return toast.error("Please choose a work type.")
    if (!description.trim()) return toast.error("Please add a booking description.")
    setSubmitting(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paId,
          date,
          startTime: minutesToHHMM(selStart),
          endTime: minutesToHHMM(selEnd),
          workType,
          task: description.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || "Failed to book")
      toast.success("Slot booked successfully.")
      setWorkType("")
      setDescription("")
      await load()
      onBooked()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to book")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{format(day, "MMMM d, yyyy")}</h2>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
          Selected day details
        </p>
      </div>

      {/* Day notices */}
      {(holiday || onLeave || isPast) && (
        <div className="mt-4 space-y-2">
          {holiday && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              Department holiday · {holiday.name}
            </div>
          )}
          {onLeave && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              PA is on approved leave this day.
            </div>
          )}
          {isPast && !onLeave && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              This date has already passed.
            </div>
          )}
        </div>
      )}

      {/* Agenda: existing bookings for the day */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Booked slots</p>
        <div className="mt-2.5 space-y-2">
          {dayBookings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400">
              <CalendarDays className="h-4 w-4" /> No bookings yet.
            </div>
          ) : (
            dayBookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-indigo-500">
                      {minutesToLabel(parseHHMM(b.start))} – {minutesToLabel(parseHHMM(b.end))}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{b.workType ?? "Task"}</p>
                    <p className="truncate text-xs text-slate-500">{b.task}</p>
                  </div>
                  {b.status === "COMPLETED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Booking form */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">New booking</p>

        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading availability…</p>
        ) : bookingDisabled ? (
          <div className="mt-2.5 rounded-xl bg-amber-50 px-3 py-3 text-center text-sm text-amber-700">
            Booking is disabled for this department.
          </div>
        ) : dayBlocked ? (
          <div className="mt-2.5 rounded-xl bg-slate-50 px-3 py-3 text-center text-sm text-slate-500">
            {onLeave ? "PA is unavailable on this day." : isPast ? "You can't book a past date." : "Unavailable."}
          </div>
        ) : slots.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No bookable hours in the department window.</p>
        ) : (
          <div className="mt-2.5">
            <div className="grid grid-cols-2 gap-2">
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
                    title={state === "booked" ? "Already booked" : state === "past" ? "Time has passed" : undefined}
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
              <p className="mt-3 text-xs font-medium text-indigo-600">
                {minutesToLabel(selStart)} – {minutesToLabel(selEnd)} ({selected.length} hr
                {selected.length > 1 ? "s" : ""})
              </p>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Work type</label>
                <select
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  className="mt-1 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="" disabled>
                    Select work type…
                  </option>
                  {WORK_TYPES.map((wt) => (
                    <option key={wt} value={wt}>
                      {wt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe what you need the PA to do…"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>

              <Button
                className="w-full bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                onClick={submit}
                disabled={submitting || !hasSelection}
              >
                {submitting ? "Booking…" : "Confirm booking"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
