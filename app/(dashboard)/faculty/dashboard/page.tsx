"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
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
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  ListTodo,
  UserSquare2,
  Users,
} from "lucide-react"
import { useSession } from "next-auth/react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BookingStatus = "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  workType: string | null
  task: string
  status: BookingStatus
  pa: { id: string; name: string | null; username: string; email: string; photoUrl: string | null }
}

const STATUS_CHIP: Record<BookingStatus, string> = {
  BOOKED: "bg-indigo-50 text-indigo-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ABSENT: "bg-red-50 text-red-700",
  CANCELLED: "bg-slate-100 text-slate-500",
}

const STATUS_LABEL: Record<BookingStatus, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  ABSENT: "Absent",
  CANCELLED: "Cancelled",
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

const dayKey = (d: Date) => format(d, "yyyy-MM-dd")

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FacultyDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  useEffect(() => {
    if (sessionStatus === "loading") return

    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      try {
        // /api/bookings returns this faculty's own bookings; /api/users is
        // scoped to their department.
        const [bookingsResponse, usersResponse] = await Promise.all([
          fetch("/api/bookings"),
          fetch("/api/users"),
        ])

        const bookingsData = await bookingsResponse.json()
        const usersData = await usersResponse.json()

        if (!active) return

        if (bookingsResponse.ok) setBookings(bookingsData.bookings ?? [])
        if (usersResponse.ok) setMembers(usersData.users ?? [])

        if (!bookingsResponse.ok && !usersResponse.ok) {
          throw new Error(bookingsData?.error || "Unable to load your dashboard")
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your dashboard")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [sessionStatus])

  const stats = useMemo(
    () => ({
      // Anything still open: booked for later today, or running right now.
      activeTasks: bookings.filter((b) => b.status === "BOOKED").length,
      totalUsers: members.length,
      faculty: members.filter((m) => m.role === "FACULTY").length,
      projectAssistants: members.filter((m) => m.role === "PROJECT_ASSISTANT").length,
      totalBookings: bookings.length,
      completedBookings: bookings.filter((b) => b.status === "COMPLETED").length,
    }),
    [bookings, members]
  )

  const calendarDays = useMemo(() => {
    const start = startOfMonth(month)
    return { days: eachDayOfInterval({ start, end: endOfMonth(month) }), leadingBlanks: getDay(start) }
  }, [month])

  const bookingsByDay = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    for (const booking of bookings) {
      const key = dayKey(new Date(booking.date))
      ;(map[key] ??= []).push(booking)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [bookings])

  const selectedBookings = bookingsByDay[dayKey(selectedDay)] ?? []

  const monthCount = useMemo(
    () =>
      Object.entries(bookingsByDay)
        .filter(([key]) => isSameMonth(new Date(`${key}T00:00:00`), month))
        .reduce((n, [, list]) => n + list.length, 0),
    [bookingsByDay, month]
  )

  const displayName = session?.user?.name ?? "there"

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Your bookings and department at a glance
          </p>
        </div>
        <Link
          href="/faculty/book-pa"
          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200/50 transition-colors hover:bg-indigo-700"
        >
          Book a PA <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          icon={<ListTodo className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600 ring-indigo-100"
          label="Active Tasks"
          value={stats.activeTasks}
          hint="Booked slots not yet closed out"
          loading={loading}
        />

        {/* Total users, split by role */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-10" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalUsers}</p>
              )}
              <p className="text-sm font-medium text-slate-500">Total Users</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <SplitStat
              icon={<GraduationCap className="h-3.5 w-3.5" />}
              label="Faculty"
              value={stats.faculty}
              className="bg-violet-50 text-violet-700"
              loading={loading}
            />
            <SplitStat
              icon={<UserSquare2 className="h-3.5 w-3.5" />}
              label="PAs"
              value={stats.projectAssistants}
              className="bg-indigo-50 text-indigo-700"
              loading={loading}
            />
          </div>
        </div>

        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 ring-emerald-100"
          label="PA Bookings"
          value={stats.totalBookings}
          hint={`${stats.completedBookings} completed to date`}
          loading={loading}
        />
      </div>

      {/* Calendar of this faculty's own bookings */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{format(month, "MMMM yyyy")}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? "Loading your schedule…"
                  : `${monthCount} booking${monthCount === 1 ? "" : "s"} this month`}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
              <button
                onClick={() => setMonth((m) => subMonths(m, 1))}
                className="cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setMonth(new Date())
                  setSelectedDay(new Date())
                }}
                className="cursor-pointer rounded-full px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wider text-slate-400"
              >
                {d}
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-7", loading && "opacity-50")}>
            {Array.from({ length: calendarDays.leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/40" />
            ))}

            {calendarDays.days.map((day) => {
              const entries = bookingsByDay[dayKey(day)] ?? []
              const selected = isSameDay(day, selectedDay)
              const visible = entries.slice(0, 2)
              const overflow = entries.length - visible.length

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-24 cursor-pointer border-b border-r border-slate-100 p-1.5 text-left align-top transition-colors hover:bg-indigo-50/40",
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
                    {visible.map((booking) => (
                      <div
                        key={booking.id}
                        className={cn(
                          "truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                          STATUS_CHIP[booking.status]
                        )}
                      >
                        {format(new Date(booking.startTime), "h:mm a")} ·{" "}
                        {booking.pa.name || booking.pa.username}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <p className="px-1.5 text-[10px] font-medium text-slate-400">+{overflow} more</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <CalendarDays className="h-4 w-4 text-indigo-600" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {format(selectedDay, "EEEE, MMM d")}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedBookings.length} booking{selectedBookings.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {selectedBookings.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                Nothing booked for this day.
              </p>
            ) : (
              selectedBookings.map((booking) => (
                <div key={booking.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <EntityAvatar
                      name={booking.pa.name}
                      fallbackText={booking.pa.email || booking.pa.username}
                      imageUrl={booking.pa.photoUrl}
                      className="h-8 w-8 shrink-0 border border-slate-200"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {booking.pa.name || booking.pa.username}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {format(new Date(booking.startTime), "h:mm a")} –{" "}
                        {format(new Date(booking.endTime), "h:mm a")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        STATUS_CHIP[booking.status]
                      )}
                    >
                      {STATUS_LABEL[booking.status]}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{booking.task}</p>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 px-5 py-3">
            <Link
              href="/faculty/bookings"
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
            >
              View all bookings <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  accent,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
  hint?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            accent
          )}
        >
          {icon}
        </div>
        <div>
          {loading ? (
            <Skeleton className="h-8 w-10" />
          ) : (
            <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          )}
          <p className="text-sm font-medium text-slate-500">{label}</p>
        </div>
      </div>
      {hint && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

function SplitStat({
  icon,
  label,
  value,
  className,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: number
  className: string
  loading?: boolean
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2", className)}>
      {icon}
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-4 w-6" />
        ) : (
          <p className="text-sm font-bold leading-none">{value}</p>
        )}
        <p className="mt-1 truncate text-[11px] font-medium opacity-80">{label}</p>
      </div>
    </div>
  )
}
