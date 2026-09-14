"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarOff, CalendarX2, Loader2, RefreshCw, Search, Undo2, Users } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { noticeWindowLabel, noticeDateKey, type Notice } from "@/components/dashboard/unavailability-panel"
import { cn } from "@/lib/utils"

/**
 * Every "I won't be in" notice Project Assistants have given. Nothing to
 * approve here — this is the admin's view of who is out when, and how many
 * bookings each notice disturbed. An admin can revert an upcoming notice on
 * the PA's behalf, which reopens the slots and tells the PA.
 */

type AdminNotice = Notice & {
  user: { id: string; name: string | null; email: string | null; photoUrl: string | null }
  department: { id: string; name: string }
}

type Department = { id: string; name: string }

const FILTERS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "withdrawn", label: "Withdrawn" },
  { key: "all", label: "All" },
] as const

type FilterKey = (typeof FILTERS)[number]["key"]

export default function AdminUnavailabilityPage() {
  const [notices, setNotices] = useState<AdminNotice[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [filter, setFilter] = useState<FilterKey>("upcoming")
  const [departmentId, setDepartmentId] = useState("all")
  const [q, setQ] = useState("")
  const [loading, setLoading] = useState(true)
  const [reverting, setReverting] = useState<AdminNotice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [noticesRes, deptRes] = await Promise.all([fetch("/api/unavailability"), fetch("/api/departments")])
      if (noticesRes.ok) {
        const data = await noticesRes.json()
        setNotices(data.notices ?? [])
      }
      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments((data.departments ?? []).map((d: Department) => ({ id: d.id, name: d.name })))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const todayKey = format(new Date(), "yyyy-MM-dd")

  const counts = useMemo(() => {
    const upcoming = notices.filter((n) => n.status === "ACTIVE" && noticeDateKey(n.date) >= todayKey)
    return {
      upcoming: upcoming.length,
      today: upcoming.filter((n) => noticeDateKey(n.date) === todayKey).length,
      affected: upcoming.reduce((sum, n) => sum + n.affectedBookings, 0),
    }
  }, [notices, todayKey])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = notices.filter((n) => {
      const key = noticeDateKey(n.date)
      if (filter === "upcoming" && !(n.status === "ACTIVE" && key >= todayKey)) return false
      if (filter === "past" && !(n.status === "ACTIVE" && key < todayKey)) return false
      if (filter === "withdrawn" && n.status !== "WITHDRAWN") return false
      if (departmentId !== "all" && n.department.id !== departmentId) return false
      if (needle) {
        const hay = `${n.user.name ?? ""} ${n.user.email ?? ""} ${n.reason ?? ""}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // Upcoming reads soonest-first; everything else newest-first
    return filter === "upcoming"
      ? [...list].sort(
          (a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "")
        )
      : list
  }, [notices, filter, departmentId, q, todayKey])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">PA Unavailability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Days and times Project Assistants have said they won&apos;t be in. Their slots are closed
            automatically and any faculty already booked have been told — nothing to approve. You can revert
            an upcoming notice if the PA will be in after all.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Out today" value={counts.today} icon={<CalendarX2 className="h-5 w-5" />} accent="bg-rose-50 text-rose-600" />
        <Stat label="Upcoming notices" value={counts.upcoming} icon={<CalendarOff className="h-5 w-5" />} accent="bg-indigo-50 text-indigo-600" />
        <Stat label="Bookings affected" value={counts.affected} icon={<Users className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, email or reason…"
            className="rounded-lg pl-9"
          />
        </div>

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

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f.key ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Project Assistant</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Unavailable</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && notices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <CalendarOff className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    No notices match these filters.
                  </td>
                </tr>
              ) : (
                visible.map((n) => {
                  const key = noticeDateKey(n.date)
                  const canRevert = n.status === "ACTIVE" && key >= todayKey
                  return (
                    <tr key={n.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <EntityAvatar
                            name={n.user.name}
                            fallbackText={n.user.email}
                            imageUrl={n.user.photoUrl}
                            size="sm"
                            className="h-8 w-8 border border-slate-200"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{n.user.name || n.user.email}</p>
                            <p className="truncate text-xs text-slate-400">{n.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{n.department.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {format(new Date(`${key}T00:00:00`), "EEE, MMM d, yyyy")}
                        {key === todayKey && (
                          <span className="ml-2 rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-600">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{noticeWindowLabel(n)}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={n.reason ?? undefined}>
                        {n.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {n.affectedBookings > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            {n.affectedBookings} notified
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            n.status === "ACTIVE" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {n.status === "WITHDRAWN" && n.withdrawnById ? "Reverted by admin" : n.status}
                        </span>
                        {n.withdrawRemark && (
                          <p className="mt-1 max-w-45 truncate text-[11px] italic text-slate-500" title={n.withdrawRemark}>
                            &ldquo;{n.withdrawRemark}&rdquo;
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canRevert && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer border-indigo-200 text-xs text-indigo-700 hover:bg-indigo-50"
                            onClick={() => setReverting(n)}
                          >
                            <Undo2 className="mr-1 h-3 w-3" /> Revert
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reverting && (
        <RevertDialog
          notice={reverting}
          onClose={() => setReverting(null)}
          onDone={() => {
            setReverting(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Confirm an admin revert. The remark is optional but goes straight to the PA
 * (bell + email), so it's the place to say why they're expected in.
 */
function RevertDialog({
  notice,
  onClose,
  onDone,
}: {
  notice: AdminNotice
  onClose: () => void
  onDone: () => void
}) {
  const [remark, setRemark] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const paName = notice.user.name || notice.user.email || "this PA"
  const key = noticeDateKey(notice.date)

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/unavailability/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW", remark: remark.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to revert the notice")
      toast.success(`Reverted — ${paName} is bookable again and has been notified.`)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revert the notice")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Revert unavailability</DialogTitle>
          <DialogDescription>
            {paName} will be marked available again on{" "}
            <span className="font-medium text-slate-700">{format(new Date(`${key}T00:00:00`), "EEE, MMM d")}</span>{" "}
            ({noticeWindowLabel(notice)}). Their slots reopen for booking, and they&apos;ll be notified
            {notice.affectedBookings > 0 ? " along with the faculty whose bookings were flagged" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label htmlFor="revert-remark" className="text-xs font-medium text-slate-600">
            Note to the PA <span className="text-slate-400">(optional)</span>
          </label>
          <Textarea
            id="revert-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Discussed on phone — please come in, we'll cover the afternoon."
            className="mt-1 resize-none text-sm"
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="flex-1 cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Reverting…
              </>
            ) : (
              "Revert notice"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accent)}>{icon}</div>
      <div>
        <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}
