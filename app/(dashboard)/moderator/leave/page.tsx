"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Check, Clock3, Inbox, ThumbsDown, ThumbsUp, X } from "lucide-react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { PageHeader } from "@/components/shared/page-header"
import { SearchInput } from "@/components/shared/search-input"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 8

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
  createdAt: string
  user: {
    id: string
    name: string | null
    username: string
    email: string | null
    role: string
    photoUrl: string | null
  }
  department: { id: string; name: string }
  approver: { id: string; name: string | null; username: string } | null
}

type Summary = { pending: number; approved: number; rejected: number }

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
}

const STATUS_LABEL: Record<LeaveStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

const FILTERS: { key: "ALL" | LeaveStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
]

export default function ModeratorLeavePage() {
  const [leaves, setLeaves] = useState<ManagedLeave[]>([])
  const [summary, setSummary] = useState<Summary>({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"ALL" | LeaveStatus>("PENDING")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<ManagedLeave | null>(null)
  const [remark, setRemark] = useState("")

  // Throws on failure so callers decide how to surface it.
  const refresh = useCallback(async () => {
    const response = await fetch("/api/leaves/managed")
    const data = await response.json()
    if (!response.ok) throw new Error(data?.error || "Unable to load leave requests")
    setLeaves(data.leaves || [])
    setSummary(data.summary || { pending: 0, approved: 0, rejected: 0 })
    setError(null)
  }, [])

  useEffect(() => {
    let active = true

    const initialLoad = async () => {
      setLoading(true)
      try {
        await refresh()
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leave requests")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void initialLoad()

    return () => {
      active = false
    }
  }, [refresh])

  async function decide(leave: ManagedLeave, status: "APPROVED" | "REJECTED", note?: string) {
    setBusyId(leave.id)
    try {
      const response = await fetch(`/api/leaves/${leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remark: note ?? "" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || "Unable to update this request")
      await refresh()
    } catch (decideError) {
      setError(decideError instanceof Error ? decideError.message : "Unable to update this request")
    } finally {
      setBusyId(null)
    }
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leaves.filter((leave) => {
      if (filter !== "ALL" && leave.status !== filter) return false
      if (!term) return true
      return [leave.user.name, leave.user.email, leave.department.name, leave.reason]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    })
  }, [leaves, filter, search])

  // Clamp against a page a filter change may have left out of range.
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)))
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleFilter = (key: "ALL" | LeaveStatus) => {
    setFilter(key)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Leave Requests"
        description="Approve or reject leave for Project Assistants across every department in the organization."
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Clock3 className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600 ring-amber-100"
          label="Awaiting your decision"
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
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100/80 p-1 ring-1 ring-slate-200/50">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => handleFilter(f.key)}
                className={cn(
                  "cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                  filter === f.key
                    ? "bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50"
                    : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by name, department or reason"
            className="lg:w-80"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-240 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Project Assistant</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Dates</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3.5 w-32" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3.5 w-40" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="ml-auto h-7 w-32" />
                    </td>
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Inbox className="mx-auto h-7 w-7 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-400">
                      {leaves.length === 0
                        ? "No leave requests from Project Assistants yet."
                        : "No requests match this view."}
                    </p>
                  </td>
                </tr>
              ) : (
                pagedRows.map((leave) => (
                  <tr
                    key={leave.id}
                    className={cn(
                      "border-b border-slate-50 last:border-0",
                      busyId === leave.id && "pointer-events-none opacity-40"
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <EntityAvatar
                          name={leave.user.name}
                          fallbackText={leave.user.email || leave.user.username}
                          imageUrl={leave.user.photoUrl}
                          className="h-9 w-9 shrink-0 border border-slate-200"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {leave.user.name || leave.user.username}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {leave.user.email || leave.user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      {leave.department.name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <p className="text-slate-900">
                        {format(new Date(leave.startDate), "MMM d")} –{" "}
                        {format(new Date(leave.endDate), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {leave.days} {leave.days === 1 ? "day" : "days"}
                      </p>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      <p className="truncate text-slate-600" title={leave.reason || undefined}>
                        {leave.reason || "No reason given"}
                      </p>
                      {leave.decisionRemark && (
                        <p className="truncate text-xs text-slate-400">
                          Remark: {leave.decisionRemark}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[leave.status]
                        )}
                      >
                        {STATUS_LABEL[leave.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {leave.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === leave.id}
                            onClick={() => decide(leave, "APPROVED")}
                            className="h-7 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === leave.id}
                            onClick={() => {
                              setRemark("")
                              setRejecting(leave)
                            }}
                            className="h-7 cursor-pointer text-red-600 hover:bg-red-50"
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {leave.decidedAt
                            ? `Decided ${format(new Date(leave.decidedAt), "MMM d, yyyy")}`
                            : "Decided"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={rows.length}
            onPageChange={setPage}
          />
        )}
      </section>

      {/* A rejection is sent back to the requester, so collect a remark first. */}
      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>
              {rejecting
                ? `${rejecting.user.name || rejecting.user.username} · ${format(
                    new Date(rejecting.startDate),
                    "MMM d"
                  )} – ${format(new Date(rejecting.endDate), "MMM d, yyyy")}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 sm:px-6">
            <label className="text-xs font-medium text-slate-600">Reason for rejection</label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              placeholder="Shared with the Project Assistant (optional)"
              className="mt-1.5"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-red-600 text-white hover:bg-red-700"
              disabled={!!busyId}
              onClick={async () => {
                if (!rejecting) return
                const target = rejecting
                setRejecting(null)
                await decide(target, "REJECTED", remark)
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
