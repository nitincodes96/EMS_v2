"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format, isThisMonth } from "date-fns"
import { ArrowRight, CalendarCheck, Clock3, ThumbsDown, ThumbsUp } from "lucide-react"
import { useSession } from "next-auth/react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { LeaveApprovals } from "@/components/dashboard/leave-approvals"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED"

type ManagedLeave = {
  id: string
  startDate: string
  endDate: string
  days: number
  reason: string | null
  status: LeaveStatus
  decisionRemark: string | null
  decidedAt: string | null
  user: { id: string; name: string | null; username: string; photoUrl: string | null }
  department: { id: string; name: string }
}

type Summary = { pending: number; approved: number; rejected: number }

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
}

export default function ModeratorDashboard() {
  const { data: session } = useSession()
  const [leaves, setLeaves] = useState<ManagedLeave[]>([])
  const [summary, setSummary] = useState<Summary>({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadLeaves = async () => {
      setLoading(true)
      try {
        const response = await fetch("/api/leaves/managed")
        const data = await response.json()

        if (!active) return

        if (!response.ok) throw new Error(data?.error || "Unable to load leave data")
        setLeaves(data.leaves || [])
        setSummary(data.summary || { pending: 0, approved: 0, rejected: 0 })
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave data")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadLeaves()

    return () => {
      active = false
    }
  }, [])

  const decidedThisMonth = useMemo(
    () => leaves.filter((leave) => leave.decidedAt && isThisMonth(new Date(leave.decidedAt))).length,
    [leaves]
  )

  const recentDecisions = useMemo(
    () =>
      leaves
        .filter((leave) => leave.status !== "PENDING" && leave.decidedAt)
        .sort((a, b) => new Date(b.decidedAt!).getTime() - new Date(a.decidedAt!).getTime())
        .slice(0, 5),
    [leaves]
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
            {format(new Date(), "EEEE, MMMM d, yyyy")} · Project Assistant leave across the organization
          </p>
        </div>
        <span className="w-fit rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
          Moderator
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600 ring-amber-100"
          label="Pending requests"
          value={summary.pending}
          loading={loading}
        />
        <StatCard
          icon={<ThumbsUp className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600 ring-emerald-100"
          label="Approved"
          value={summary.approved}
          loading={loading}
        />
        <StatCard
          icon={<ThumbsDown className="h-5 w-5" />}
          accent="bg-red-50 text-red-600 ring-red-100"
          label="Rejected"
          value={summary.rejected}
          loading={loading}
        />
        <StatCard
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600 ring-indigo-100"
          label="Decided this month"
          value={decidedThisMonth}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Queue — approve or reject straight from here */}
        <div className="xl:col-span-2">
          <LeaveApprovals title="Pending Project Assistant leave" />
          <Link
            href="/moderator/leave"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
          >
            Open full leave queue <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Recent decisions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Recent decisions</h2>
            <p className="mt-1 text-sm text-slate-500">The last requests you closed out.</p>
          </div>

          <div className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex items-center gap-3 px-5 py-3.5">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))
            ) : recentDecisions.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                No decisions recorded yet.
              </p>
            ) : (
              recentDecisions.map((leave) => (
                <div key={leave.id} className="flex items-center gap-3 px-5 py-3.5">
                  <EntityAvatar
                    name={leave.user.name}
                    fallbackText={leave.user.username}
                    imageUrl={leave.user.photoUrl}
                    className="h-9 w-9 shrink-0 border border-slate-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {leave.user.name || leave.user.username}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {format(new Date(leave.startDate), "MMM d")} –{" "}
                      {format(new Date(leave.endDate), "MMM d")} · {leave.department.name}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      STATUS_STYLES[leave.status]
                    )}
                  >
                    {leave.status}
                  </span>
                </div>
              ))
            )}
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
  loading,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
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
  )
}
