"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarClock, CheckCircle2, ClipboardList, ListTodo } from "lucide-react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Mock data — swap for a real tasks API later
// ---------------------------------------------------------------------------

type TaskStatus = "TODAY" | "UPCOMING" | "COMPLETED"

type Task = {
  id: string
  title: string
  faculty: string
  date: string // yyyy-MM-dd
  startTime: string
  endTime: string
  status: TaskStatus
}

const today = new Date()
const iso = (offsetDays: number) => format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays), "yyyy-MM-dd")

const MOCK_TASKS: Task[] = [
  { id: "t1", title: "Compile Q3 attendance report", faculty: "Dr. S. Jenkins", date: iso(0), startTime: "09:30", endTime: "11:00", status: "TODAY" },
  { id: "t2", title: "Prepare seminar hall booking sheet", faculty: "Prof. R. Mehta", date: iso(0), startTime: "13:00", endTime: "14:00", status: "TODAY" },
  { id: "t3", title: "Client proposal formatting", faculty: "Dr. S. Jenkins", date: iso(1), startTime: "10:00", endTime: "12:00", status: "UPCOMING" },
  { id: "t4", title: "Update department inventory sheet", faculty: "Prof. A. Iyer", date: iso(3), startTime: "11:00", endTime: "12:30", status: "UPCOMING" },
  { id: "t5", title: "Faculty meeting minutes", faculty: "Prof. R. Mehta", date: iso(5), startTime: "15:00", endTime: "16:00", status: "UPCOMING" },
  { id: "t6", title: "Guest lecture coordination", faculty: "Dr. S. Jenkins", date: iso(-1), startTime: "09:00", endTime: "10:30", status: "COMPLETED" },
  { id: "t7", title: "Lab equipment audit", faculty: "Prof. A. Iyer", date: iso(-2), startTime: "14:00", endTime: "16:00", status: "COMPLETED" },
  { id: "t8", title: "Exam hall seating chart", faculty: "Prof. R. Mehta", date: iso(-4), startTime: "10:00", endTime: "11:30", status: "COMPLETED" },
]

const STATUS_STYLES: Record<TaskStatus, string> = {
  TODAY: "bg-indigo-50 text-indigo-600",
  UPCOMING: "bg-amber-50 text-amber-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODAY: "Today",
  UPCOMING: "Upcoming",
  COMPLETED: "Completed",
}

const FILTERS: { key: "ALL" | TaskStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "TODAY", label: "Today" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "COMPLETED", label: "Completed" },
]

export default function PATasksPage() {
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL")

  const stats = useMemo(
    () => ({
      today: MOCK_TASKS.filter((t) => t.status === "TODAY").length,
      upcoming: MOCK_TASKS.filter((t) => t.status === "UPCOMING").length,
      completed: MOCK_TASKS.filter((t) => t.status === "COMPLETED").length,
    }),
    []
  )

  const rows = useMemo(() => {
    const sorted = [...MOCK_TASKS].sort((a, b) => a.date.localeCompare(b.date))
    return filter === "ALL" ? sorted : sorted.filter((t) => t.status === filter)
  }, [filter])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tasks assigned to you by faculty. Check in from Attendance to become bookable.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<CalendarClock className="h-5 w-5" />} accent="bg-indigo-50 text-indigo-600" label="Today's tasks" value={stats.today} />
        <StatCard icon={<ListTodo className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" label="Upcoming" value={stats.upcoming} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600" label="Completed" value={stats.completed} />
      </div>

      {/* Detailed table */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ClipboardList className="h-4 w-4 text-indigo-600" /> Task list
          </h2>
          <div className="flex gap-1.5 rounded-full bg-slate-100 p-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
                  filter === f.key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Task</th>
                <th className="px-5 py-3">Faculty</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    No tasks in this view.
                  </td>
                </tr>
              ) : (
                rows.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">{t.title}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <EntityAvatar name={t.faculty} size="sm" className="h-6 w-6" />
                        <span className="text-slate-600">{t.faculty}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{format(new Date(t.date), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {t.startTime}–{t.endTime}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[t.status])}>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, accent, label, value }: { icon: React.ReactNode; accent: string; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>{icon}</span>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
