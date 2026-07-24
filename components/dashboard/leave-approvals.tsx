"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, Inbox, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PendingLeave = {
  id: string
  reason: string | null
  startDate: string
  endDate: string
  user: { id: string; name: string | null; username: string; email: string; role: string }
  department: { id: string; name: string }
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  FACULTY: "Faculty",
  PROJECT_ASSISTANT: "Project Assistant",
  MODERATOR: "Moderator",
}

export function LeaveApprovals({ title = "Pending approvals" }: { title?: string }) {
  const [leaves, setLeaves] = useState<PendingLeave[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/leaves/pending")
      const data = await res.json()
      if (res.ok) setLeaves(data.leaves ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    const remark = status === "REJECTED" ? window.prompt("Reason for rejection (optional):") ?? "" : ""
    setBusy(id)
    try {
      const res = await fetch(`/api/leaves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remark }),
      })
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : leaves.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Inbox className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No pending leave requests.</p>
          </div>
        ) : (
          leaves.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{l.user.name || l.user.username}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                    {ROLE_LABEL[l.user.role] ?? l.user.role}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {format(new Date(l.startDate), "MMM d")} – {format(new Date(l.endDate), "MMM d, yyyy")}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{l.reason || "No reason given"}</p>
                <p className="text-[11px] text-slate-400">{l.department.name}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  disabled={busy === l.id}
                  onClick={() => decide(l.id, "APPROVED")}
                  className={cn("cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700")}
                >
                  <Check className="mr-1 h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === l.id}
                  onClick={() => decide(l.id, "REJECTED")}
                  className="cursor-pointer text-red-600 hover:bg-red-50"
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
