"use client"

import { useMemo, useState } from "react"
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
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Pencil, StickyNote } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Mock data — swap for a real tasks/leave/holiday API later
// ---------------------------------------------------------------------------

type EntryType = "TASK" | "COMPLETED" | "LEAVE" | "HOLIDAY"

type DayEntry = {
  id: string
  time: string
  title: string
  subtitle: string
  type: EntryType
}

const today = new Date()
const iso = (offsetDays: number) =>
  format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays), "yyyy-MM-dd")

const CALENDAR_ENTRIES: Record<string, DayEntry[]> = {
  [iso(0)]: [
    { id: "e1", time: "09:00", title: "Frontend Sprint Review", subtitle: "Room 402 · 1.5 hrs", type: "TASK" },
    { id: "e2", time: "11:30", title: "Client Proposal Draft", subtitle: "Shared via SharePoint", type: "COMPLETED" },
    { id: "e3", time: "14:00", title: "API Integration Check", subtitle: "Backend Team · Virtual", type: "TASK" },
  ],
  [iso(-4)]: [{ id: "e4", time: "All day", title: "National Holiday", subtitle: "Department closed", type: "HOLIDAY" }],
  [iso(2)]: [{ id: "e5", time: "10:30", title: "Dev Review", subtitle: "Prof. R. Mehta · Room 210", type: "TASK" }],
  [iso(4)]: [{ id: "e6", time: "16:00", title: "Project Alpha Launch", subtitle: "All hands · Auditorium", type: "COMPLETED" }],
  [iso(-1)]: [
    { id: "e7", time: "09:30", title: "Q4 Kickoff Meeting", subtitle: "Dr. S. Jenkins · Room 101", type: "TASK" },
    { id: "e8", time: "13:00", title: "Infrastructure Sync", subtitle: "IT Desk · Virtual", type: "COMPLETED" },
  ],
  [iso(10)]: [{ id: "e9", time: "All day", title: "S. Jenkins – Annual Leave", subtitle: "Faculty on leave", type: "LEAVE" }],
  [iso(11)]: [{ id: "e10", time: "All day", title: "S. Jenkins – Annual Leave", subtitle: "Faculty on leave", type: "LEAVE" }],
}

const CONTEXTUAL_NOTES: Record<string, string> = {
  [iso(0)]:
    "Focus on the mobile responsiveness bottlenecks discussed during the Tuesday standup. Finalize the icon set migration by EOD.",
  [iso(-1)]: "Bring last quarter's booking numbers to the kickoff meeting.",
  [iso(2)]: "Dev review covers the attendance geofencing changes — have the test logs ready.",
}

const TYPE_CHIP: Record<EntryType, string> = {
  TASK: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  LEAVE: "bg-red-50 text-red-700",
  HOLIDAY: "bg-amber-50 text-amber-700",
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd")
}

export default function CalendarPage() {
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const days = eachDayOfInterval({ start, end })
    const leadingBlanks = getDay(start) // 0 = Sunday, grid starts on Sunday
    return { days, leadingBlanks }
  }, [month])

  const selectedEntries = CALENDAR_ENTRIES[dayKey(selectedDay)] ?? []
  const selectedNote = CONTEXTUAL_NOTES[dayKey(selectedDay)]

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{format(month, "MMMM yyyy")}</h1>
          <p className="mt-1 text-sm text-slate-500">Project Intelligence: Task planning</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setMonth(new Date())
              setSelectedDay(new Date())
            }}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Today
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
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

          <div className="grid grid-cols-7">
            {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40" />
            ))}

            {calendarDays.days.map((day) => {
              const entries = CALENDAR_ENTRIES[dayKey(day)] ?? []
              const selected = isSameDay(day, selectedDay)
              const visible = entries.slice(0, 2)
              const overflow = entries.length - visible.length

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors last:border-r-0 hover:bg-indigo-50/40 cursor-pointer",
                    selected && "bg-indigo-50 ring-2 ring-inset ring-indigo-500",
                    !isSameMonth(day, month) && "opacity-40"
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
                    {overflow > 0 && <div className="px-1.5 text-[10px] font-medium text-slate-400">+{overflow} more</div>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{format(selectedDay, "MMMM d, yyyy")}</h2>
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
                  Selected day details
                </p>
              </div>
              <Pencil className="h-4 w-4 text-slate-300" />
            </div>

            {/* Key indicators */}
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Key indicators</p>
              <div className="mt-2.5 space-y-2">
                <Legend dot="bg-indigo-500" label="Assigned Tasks" />
                <Legend dot="bg-emerald-500" label="Completed" />
                <Legend dot="bg-red-500" label="Leave / Holidays" />
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
                        {entry.type === "COMPLETED" ? (
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

            {/* Contextual notes */}
            {selectedNote && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <StickyNote className="h-3.5 w-3.5" /> Contextual notes
                </p>
                <div className="mt-2.5 rounded-xl bg-indigo-50/60 p-3">
                  <p className="text-xs italic leading-relaxed text-indigo-900">&ldquo;{selectedNote}&rdquo;</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {label}
    </div>
  )
}
