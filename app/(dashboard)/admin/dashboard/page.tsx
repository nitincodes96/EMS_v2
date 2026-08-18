"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Building2,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Stats = {
  departments: number
  totalUsers: number
  paCount: number
  facultyCount: number
  activeBookings: number
  todayPresent: number
  todayExpected: number
  todayAttendanceRate: number
}

type BookingPoint = { day: string; booked: number; completed: number; incomplete: number; absent: number }
type AttendancePoint = { day: string; onTime: number; late: number; absent: number }

type Department = { id: string; name: string }

type RecentBooking = {
  id: string
  date: string
  slot: string
  workType: string | null
  status: "BOOKED" | "COMPLETED" | "INCOMPLETE" | "ABSENT" | "CANCELLED"
  facultyName: string
  paName: string
  departmentName: string
}

const STATUS_STYLES: Record<RecentBooking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  INCOMPLETE: "bg-amber-50 text-amber-600",
  ABSENT: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
}

const CHART_TOOLTIP = {
  cursor: { fill: "#f8fafc" },
  contentStyle: { borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 },
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState("all")
  const [bookingSeries, setBookingSeries] = useState<BookingPoint[]>([])
  const [attendanceSeries, setAttendanceSeries] = useState<AttendancePoint[]>([])
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/overview?departmentId=${departmentId}`)
      const data = await res.json()
      if (res.ok) {
        setStats(data.stats ?? null)
        setDepartments(data.departments ?? [])
        setBookingSeries(data.bookingSeries ?? [])
        setAttendanceSeries(data.attendanceSeries ?? [])
        setRecentBookings(data.recentBookings ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  const scopeLabel =
    departmentId === "all"
      ? "across all departments"
      : `in ${departments.find((d) => d.id === departmentId)?.name ?? "this department"}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Overview {scopeLabel}.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={load} className="cursor-pointer">
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600"
          label="Active Bookings"
          value={stats ? String(stats.activeBookings) : "—"}
          sub="Slots booked and not yet finished"
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
          label="Today's Attendance"
          value={stats ? `${stats.todayAttendanceRate}%` : "—"}
          sub={stats ? `${stats.todayPresent} of ${stats.todayExpected} PAs punched in` : undefined}
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          accent="bg-violet-50 text-violet-600"
          label="Departments"
          value={stats ? String(stats.departments) : "—"}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
          label="Total Users"
          value={stats ? String(stats.totalUsers) : "—"}
          sub={stats ? `${stats.facultyCount} faculty · ${stats.paCount} PAs` : undefined}
        />
      </div>

      {/* Breakdowns — bookings leads, attendance alongside it */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Weekly Bookings Breakdown</h2>
            <p className="text-sm text-slate-500">
              Booked vs. completed vs. no-show slots over the last 7 days, {scopeLabel}.
            </p>
          </div>

          <div className="mt-4 h-72 w-full">
            {loading && bookingSeries.length === 0 ? (
              <p className="py-24 text-center text-sm text-slate-400">Loading bookings…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingSeries} barGap={4}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
                  <Bar dataKey="booked" name="Booked" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="incomplete" name="Not completed" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="No-show" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Weekly Attendance Breakdown</h2>
            <p className="text-sm text-slate-500">On time vs. late vs. no punch, {scopeLabel}.</p>
          </div>

          <div className="mt-4 h-72 w-full">
            {loading && attendanceSeries.length === 0 ? (
              <p className="py-24 text-center text-sm text-slate-400">Loading attendance…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceSeries} barGap={4}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#64748b" }} />
                  <Bar dataKey="onTime" name="On time" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="No punch" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Recent Bookings</h2>
          <Link href="/admin/bookings" className="text-sm font-medium text-indigo-600 hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-4 divide-y divide-slate-100">
          {recentBookings.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {loading ? "Loading…" : "No bookings yet."}
            </p>
          ) : (
            recentBookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="group flex items-center gap-3 py-3 transition-colors hover:bg-slate-50/60"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    STATUS_STYLES[b.status]
                  )}
                >
                  {b.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {b.paName} <span className="font-normal text-slate-400">booked by</span> {b.facultyName}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {b.departmentName} · {b.date} · {b.slot}
                    {b.workType ? ` · ${b.workType}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
              </Link>
            ))
          )}
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
  sub,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>{icon}</span>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}
