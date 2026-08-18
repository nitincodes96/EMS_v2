"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, ChevronLeft, ChevronRight, Clock3, RefreshCw, Search, ThumbsDown, ThumbsUp, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type Leave = {
  id: string
  reason: string | null
  startDate: string
  endDate: string
  days: number
  status: "PENDING" | "APPROVED" | "REJECTED"
  decisionRemark: string | null
  decidedAt: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    role: string
    photoUrl: string | null
  }
  department: { id: string; name: string } | null
  approver: string | null
}

type Department = { id: string; name: string }

const PAGE_SIZE = 15

const FILTERS = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "all", label: "All" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

const STATUS_STYLES: Record<Leave["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-600",
  REJECTED: "bg-red-50 text-red-600",
}

export default function AdminLeavePage() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })

  const [status, setStatus] = useState<FilterKey>("PENDING")
  const [departmentId, setDepartmentId] = useState("all")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Leave | null>(null)
  const [remark, setRemark] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        departmentId,
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (q.trim()) params.set("q", q.trim())

      const res = await fetch(`/api/admin/leaves?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLeaves(data.leaves ?? [])
        setDepartments(data.departments ?? [])
        if (data.counts) setCounts(data.counts)
        if (data.pagination) setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [status, departmentId, page, q])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(leave: Leave, nextStatus: "APPROVED" | "REJECTED", note?: string) {
    setBusyId(leave.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/leaves/${leave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, remark: note ?? "" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Unable to update this request")
      await load()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to update this request")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leave</h1>
          <p className="mt-1 text-sm text-slate-500">
            Approve or reject leave for Faculty and Project Assistants across every department — Project
            Assistant requests can also be decided by a Moderator.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Pending"
          value={counts.pending}
          icon={<Clock3 className="h-5 w-5" />}
          accent="bg-amber-50 text-amber-600"
        />
        <Stat
          label="Approved"
          value={counts.approved}
          icon={<ThumbsUp className="h-5 w-5" />}
          accent="bg-emerald-50 text-emerald-600"
        />
        <Stat
          label="Rejected"
          value={counts.rejected}
          icon={<ThumbsDown className="h-5 w-5" />}
          accent="bg-red-50 text-red-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name or email…"
            className="rounded-lg pl-9"
          />
        </div>

        <select
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value)
            setPage(1)
          }}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setStatus(f.key)
                setPage(1)
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                status === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-240 text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Requested by</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Decided by</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    {loading ? "Loading leave requests…" : "No leave requests match these filters."}
                  </td>
                </tr>
              ) : (
                leaves.map((l) => (
                  <tr
                    key={l.id}
                    className={cn(
                      "border-b border-slate-50 last:border-0",
                      busyId === l.id && "pointer-events-none opacity-40"
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar
                          name={l.user.name}
                          fallbackText={l.user.email}
                          imageUrl={l.user.photoUrl}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{l.user.name || l.user.email}</p>
                          <p className="truncate text-xs text-slate-400">{l.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {l.user.role === "PROJECT_ASSISTANT" ? "PA" : l.user.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.department?.name ?? "—"}</td>
                    <td className="max-w-xs px-4 py-3">
                      <p className="truncate text-slate-700">{l.reason || "—"}</p>
                      {l.decisionRemark && (
                        <p className="truncate text-xs italic text-slate-400">Remark: {l.decisionRemark}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {format(new Date(l.startDate), "MMM d")} – {format(new Date(l.endDate), "MMM d, yyyy")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.days}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="text-slate-600">{l.approver ?? "—"}</p>
                      {l.decidedAt && (
                        <p className="text-xs text-slate-400">{format(new Date(l.decidedAt), "MMM d, yyyy")}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[l.status]
                        )}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {l.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busyId === l.id}
                            onClick={() => decide(l, "APPROVED")}
                            className="h-7 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Check className="mr-1 h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === l.id}
                            onClick={() => {
                              setRemark("")
                              setRejecting(l)
                            }}
                            className="h-7 cursor-pointer text-red-600 hover:bg-red-50"
                          >
                            <X className="mr-1 h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row">
            <p className="text-sm text-slate-500">
              Page <span className="font-medium text-slate-700">{pagination.page}</span> of{" "}
              <span className="font-medium text-slate-700">{pagination.totalPages}</span> · {pagination.total} requests
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pagination.page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="cursor-pointer"
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* A rejection is sent back to the requester, so collect a remark first. */}
      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>
              {rejecting
                ? `${rejecting.user.name || rejecting.user.email} · ${format(
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
              placeholder="Shared with the requester (optional)"
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

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>{icon}</span>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
