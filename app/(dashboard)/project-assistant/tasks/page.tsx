"use client"

import { useMemo, useState } from "react"
import { format, isToday, isTomorrow, parse } from "date-fns"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  ListTodo,
  LoaderCircle,
  MapPin,
  ArrowRight
} from "lucide-react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED"

type Requester = {
  name: string
  role: "FACULTY" | "ADMIN"
  department: string
}

type Task = {
  id: string
  title: string
  instructions: string
  requester: Requester
  date: string 
  startTime: string 
  endTime: string 
  location: string
  status: TaskStatus
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const today = new Date()
const iso = (offsetDays: number) =>
  format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays), "yyyy-MM-dd")

const MOCK_TASKS: Task[] = [
  {
    id: "t1",
    title: "Compile Q3 attendance report",
    instructions:
      "Pull the department attendance export for July–September, reconcile it against the leave register, and flag anyone below 75%. Share the draft sheet before you leave for the day.",
    requester: { name: "Dr. S. Jenkins", role: "FACULTY", department: "Computer Science" },
    date: iso(0),
    startTime: "09:30",
    endTime: "11:00",
    location: "Block C · Room 204",
    status: "IN_PROGRESS",
  },
  {
    id: "t2",
    title: "Seminar hall booking sheet",
    instructions:
      "Confirm the projector and mic setup with facilities, then update the booking sheet for next week's guest lectures. Print two copies for the notice board.",
    requester: { name: "Prof. R. Mehta", role: "FACULTY", department: "Electrical Engineering" },
    date: iso(0),
    startTime: "13:00",
    endTime: "14:00",
    location: "Seminar Hall 1",
    status: "UPCOMING",
  },
  {
    id: "t3",
    title: "Digitise vendor invoices",
    instructions:
      "Scan the pending purchase invoices from the accounts tray, name each file by vendor and date, and upload them to the shared procurement folder.",
    requester: { name: "Admin Office", role: "ADMIN", department: "Administration" },
    date: iso(0),
    startTime: "15:00",
    endTime: "17:00",
    location: "Admin Block · Records Room",
    status: "UPCOMING",
  },
  {
    id: "t4",
    title: "Client proposal formatting",
    instructions:
      "Apply the institute template to the consultancy proposal, fix the figure numbering, and regenerate the table of contents. Keep track changes on.",
    requester: { name: "Dr. S. Jenkins", role: "FACULTY", department: "Computer Science" },
    date: iso(1),
    startTime: "10:00",
    endTime: "12:00",
    location: "Block C · Room 204",
    status: "UPCOMING",
  },
  {
    id: "t5",
    title: "Lab equipment audit",
    instructions:
      "Walk the two teaching labs with the inventory list, mark items that are missing or out of service, and note serial numbers for anything newly installed.",
    requester: { name: "Prof. A. Iyer", role: "FACULTY", department: "Mechanical Engineering" },
    date: iso(3),
    startTime: "11:00",
    endTime: "12:30",
    location: "Lab 2 · Ground Floor",
    status: "UPCOMING",
  },
  {
    id: "t6",
    title: "Faculty meeting minutes",
    instructions:
      "Take minutes for the departmental review, circulate them within 24 hours, and list every action item with an owner and a due date.",
    requester: { name: "Prof. R. Mehta", role: "FACULTY", department: "Electrical Engineering" },
    date: iso(5),
    startTime: "15:00",
    endTime: "16:00",
    location: "Conference Room B",
    status: "UPCOMING",
  },
  {
    id: "t7",
    title: "Guest lecture coordination",
    instructions:
      "Receive the visiting speaker at the gate, set up the presentation, and hand over the honorarium form for signature after the session.",
    requester: { name: "Dr. S. Jenkins", role: "FACULTY", department: "Computer Science" },
    date: iso(-1),
    startTime: "09:00",
    endTime: "10:30",
    location: "Auditorium",
    status: "COMPLETED",
  },
  {
    id: "t8",
    title: "Exam hall seating chart",
    instructions:
      "Generate the seating plan for the mid-semester exam from the registration list, keeping adjacent seats in different sections.",
    requester: { name: "Prof. R. Mehta", role: "FACULTY", department: "Electrical Engineering" },
    date: iso(-2),
    startTime: "10:00",
    endTime: "11:30",
    location: "Exam Cell",
    status: "COMPLETED",
  },
  {
    id: "t9",
    title: "Update department inventory sheet",
    instructions:
      "Enter last month's consumable purchases into the inventory workbook and reconcile the closing stock against the store register.",
    requester: { name: "Admin Office", role: "ADMIN", department: "Administration" },
    date: iso(-4),
    startTime: "14:00",
    endTime: "16:00",
    location: "Admin Block · Stores",
    status: "COMPLETED",
  },
]

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badge: string; accent: string; icon: React.ReactNode; glow: string }
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
    icon: <LoaderCircle className="h-3 w-3 animate-spin-slow" />,
  },
  COMPLETED: {
    label: "Completed",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    accent: "border-l-emerald-500",
    glow: "group-hover:shadow-emerald-200/50",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
}

const STATUS_RANK: Record<TaskStatus, number> = {
  IN_PROGRESS: 0,
  UPCOMING: 1,
  COMPLETED: 2,
}

const FILTERS: { key: "ALL" | TaskStatus; label: string }[] = [
  { key: "ALL", label: "All Tasks" },
  { key: "UPCOMING", label: "Upcoming" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const to12Hour = (time: string) => format(parse(time, "HH:mm", new Date()), "h:mm a")

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
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL")

  const stats = useMemo(
    () => ({
      upcoming: MOCK_TASKS.filter((t) => t.status === "UPCOMING").length,
      inProgress: MOCK_TASKS.filter((t) => t.status === "IN_PROGRESS").length,
      completed: MOCK_TASKS.filter((t) => t.status === "COMPLETED").length,
    }),
    []
  )

  const tasks = useMemo(() => {
    const sorted = [...MOCK_TASKS].sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime)
    )
    return filter === "ALL" ? sorted : sorted.filter((t) => t.status === filter)
  }, [filter])

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="My Tasks"
        description="Manage your assigned work and keep track of your schedule. Remember to check in to activate your availability."
      />

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
        
        {/* Segmented Control Filter */}
        <div className="inline-flex rounded-xl bg-slate-100/80 p-1 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "relative flex items-center justify-center rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200",
                filter === f.key
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
            <ListTodo className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="mt-5 text-base font-semibold text-slate-900">No tasks found</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            You don't have any tasks in this view. Change your filter or wait for a new assignment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card Component
// ---------------------------------------------------------------------------

function TaskCard({ task }: { task: Task }) {
  const status = STATUS_CONFIG[task.status]
  const isPending = task.status !== "COMPLETED"

  return (
    <article
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        "border-l-4",
        status.accent,
        status.glow
      )}
    >
      {/* Header: Status + Date */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase",
            status.badge
          )}
        >
          {status.icon}
          {status.label}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
          {relativeDay(task.date)}
        </span>
      </div>

      {/* Content: Title & Time */}
      <h3 className="text-base font-semibold leading-snug text-slate-900 group-hover:text-indigo-600 transition-colors">
        {task.title}
      </h3>
      
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/50">
          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
          {to12Hour(task.startTime)} 
          <ArrowRight className="h-3 w-3 text-slate-300 mx-0.5" /> 
          {to12Hour(task.endTime)}
        </div>
      </div>

      {/* Instructions */}
      <p className="mt-4 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
        {task.instructions}
      </p>

      {/* Footer: Requester & Location */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <EntityAvatar name={task.requester.name} size="sm" className="h-9 w-9 shadow-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{task.requester.name}</p>
            <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
              {task.requester.role === "ADMIN" ? (
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              ) : (
                <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              )}
              {task.requester.department}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60 text-xs font-medium text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{task.location}</span>
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Stat Component
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