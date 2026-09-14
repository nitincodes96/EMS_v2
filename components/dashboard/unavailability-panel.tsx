"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarOff, CalendarPlus, Loader2, Undo2 } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { minutesToLabel, parseHHMM } from "@/lib/booking-slots"
import { cn } from "@/lib/utils"

/**
 * A Project Assistant's "I won't be in" notices. There is no approval — a
 * notice takes effect the moment it's saved: admins are told, the slots drop
 * off the booking calendar, and any faculty already booked in that window
 * are notified.
 */

export type Notice = {
  id: string
  date: string
  startTime: string | null
  endTime: string | null
  reason: string | null
  status: "ACTIVE" | "WITHDRAWN"
  affectedBookings: number
  createdAt: string
  withdrawnAt: string | null
  withdrawnById: string | null
  withdrawRemark: string | null
}

const STATUS_STYLES: Record<Notice["status"], string> = {
  ACTIVE: "bg-rose-50 text-rose-600",
  WITHDRAWN: "bg-slate-100 text-slate-500",
}

/** "yyyy-MM-dd" for a @db.Date value without letting the timezone shift the day. */
export function noticeDateKey(date: string): string {
  return date.slice(0, 10)
}

export function noticeWindowLabel(n: Pick<Notice, "startTime" | "endTime">): string {
  if (!n.startTime || !n.endTime) return "All day"
  return `${minutesToLabel(parseHHMM(n.startTime))} – ${minutesToLabel(parseHHMM(n.endTime))}`
}

export function UnavailabilityPanel() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/unavailability")
      const data = await res.json()
      if (res.ok) setNotices(data.notices ?? [])
      else toast.error(data?.error || "Failed to load your notices")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const todayKey = format(new Date(), "yyyy-MM-dd")
  const upcoming = useMemo(
    () => notices.filter((n) => n.status === "ACTIVE" && noticeDateKey(n.date) >= todayKey),
    [notices, todayKey]
  )
  const affected = useMemo(() => upcoming.reduce((sum, n) => sum + n.affectedBookings, 0), [upcoming])

  async function withdraw(id: string) {
    setWithdrawingId(id)
    try {
      const res = await fetch(`/api/unavailability/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "WITHDRAW" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to withdraw")
      toast.success("Notice withdrawn — your slots are open again.")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to withdraw")
    } finally {
      setWithdrawingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Unavailability</h1>
          <p className="mt-1 text-sm text-slate-500">
            Let the admin know when you won&apos;t be in. Your slots close immediately — nothing to approve.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700">
          <CalendarPlus className="mr-1.5 h-4 w-4" /> Mark unavailable
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Stat label="Upcoming notices" value={upcoming.length} accent="text-rose-600" />
        <Stat label="Bookings affected" value={affected} accent="text-amber-600" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Unavailable</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-600" />
                  </td>
                </tr>
              ) : notices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    <CalendarOff className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                    You haven&apos;t marked any days as unavailable.
                  </td>
                </tr>
              ) : (
                notices.map((n) => {
                  const key = noticeDateKey(n.date)
                  const canWithdraw = n.status === "ACTIVE" && key >= todayKey
                  return (
                    <tr key={n.id} className="border-b border-slate-50 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {format(new Date(`${key}T00:00:00`), "EEE, MMM d, yyyy")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{noticeWindowLabel(n)}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={n.reason ?? undefined}>
                        {n.reason || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
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
                            STATUS_STYLES[n.status]
                          )}
                        >
                          {n.status === "WITHDRAWN" && n.withdrawnById ? "Reverted by admin" : n.status}
                        </span>
                        {n.withdrawRemark && (
                          <p className="mt-1 max-w-xs truncate text-[11px] italic text-slate-500" title={n.withdrawRemark}>
                            &ldquo;{n.withdrawRemark}&rdquo;
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWithdraw && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 cursor-pointer text-xs"
                            onClick={() => withdraw(n.id)}
                            disabled={withdrawingId === n.id}
                          >
                            {withdrawingId === n.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Undo2 className="mr-1 h-3 w-3" /> Withdraw
                              </>
                            )}
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

      {showForm && (
        <UnavailabilityForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            void load()
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

export function UnavailabilityForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const todayStr = format(new Date(), "yyyy-MM-dd")
  const [date, setDate] = useState(todayStr)
  const [wholeDay, setWholeDay] = useState(true)
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!date) return setError("Pick a date.")
    if (!wholeDay) {
      if (!startTime || !endTime) return setError("Enter the time you'll be away from and until.")
      if (endTime <= startTime) return setError("End time must be after the start time.")
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/unavailability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          wholeDay,
          startTime: wholeDay ? undefined : startTime,
          endTime: wholeDay ? undefined : endTime,
          reason: reason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to save")
      const n = data.affectedBookings as number
      toast.success(
        n > 0
          ? `Saved. Admin notified, and ${n} faculty booking${n === 1 ? "" : "s"} in that window ${n === 1 ? "was" : "were"} flagged.`
          : "Saved. Admin has been notified."
      )
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Mark yourself unavailable</DialogTitle>
          <DialogDescription>
            Faculty won&apos;t be able to book you in this window. Anyone who already has will be told.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="unav-date" className="text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              id="unav-date"
              type="date"
              value={date}
              min={todayStr}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Whole day</p>
              <p className="mt-0.5 text-xs text-slate-500">Turn off to give just a time window.</p>
            </div>
            <Switch
              checked={wholeDay}
              onCheckedChange={(checked: boolean) => setWholeDay(checked)}
              className="mt-0.5 shrink-0 data-checked:bg-indigo-600"
            />
          </div>

          {!wholeDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="unav-start" className="text-xs font-medium text-slate-600">
                  From
                </label>
                <input
                  id="unav-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label htmlFor="unav-end" className="text-xs font-medium text-slate-600">
                  Until
                </label>
                <input
                  id="unav-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="unav-reason" className="text-xs font-medium text-slate-600">
              Reason <span className="text-slate-400">(optional, shared with admin and affected faculty)</span>
            </label>
            <textarea
              id="unav-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. Doctor's appointment"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
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
            {submitting ? "Saving…" : "Save notice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
