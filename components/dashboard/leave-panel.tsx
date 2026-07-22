"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarPlus, Plane } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Leave = {
  id: string
  leaveType: string
  reason: string | null
  startDate: string
  endDate: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  decisionRemark: string | null
}

type Summary = { usedLeaveDays: number; pendingLeaves: number }

const LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"]

const STATUS_STYLES: Record<Leave["status"], string> = {
  PENDING: "bg-amber-50 text-amber-600",
  APPROVED: "bg-emerald-50 text-emerald-600",
  REJECTED: "bg-red-50 text-red-600",
}

export function LeavePanel() {
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/leaves")
    const data = await res.json()
    if (res.ok) {
      setLeaves(data.leaves ?? [])
      setSummary(data.summary ?? null)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leave</h1>
          <p className="mt-1 text-sm text-slate-500">Apply for leave and track your requests.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Apply for leave
        </Button>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <Stat label="Used this year" value={summary.usedLeaveDays} accent="text-emerald-600" />
          <Stat label="Pending" value={summary.pendingLeaves} accent="text-amber-600" />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Remark</th>
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  <Plane className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No leave requests yet.
                </td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium capitalize text-slate-900">{l.leaveType.toLowerCase()}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(l.startDate), "MMM d")} – {format(new Date(l.endDate), "MMM d, yyyy")}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{l.reason || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[l.status])}>
                      {l.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-500">{l.decisionRemark || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <LeaveForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold text-slate-900", accent)}>{value}</p>
    </div>
  )
}

function LeaveForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [leaveType, setLeaveType] = useState("CASUAL")
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to submit")
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-900">Apply for leave</h2>
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Leave type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">To</label>
              <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </div>
  )
}
