"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { CalendarPlus, RefreshCw, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type PA = {
  id: string
  name: string | null
  username: string
  email: string
  photoUrl: string | null
  availabilitySince: string | null
  department: { id: string; name: string } | null
}

export default function BookPAPage() {
  const [pas, setPas] = useState<PA[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PA | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/availability")
      const data = await res.json()
      if (res.ok) setPas(data.pas ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Book a Project Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">
            Currently punched-in PAs in your department are available to book.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {loading && pas.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading available PAs…</p>
      ) : pas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No PAs are available right now</p>
          <p className="text-xs text-slate-400">PAs appear here once they punch in.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pas.map((pa) => (
            <div key={pa.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <EntityAvatar
                  name={pa.name || pa.username}
                  fallbackText={pa.name || pa.username}
                  imageUrl={pa.photoUrl}
                  className="h-11 w-11"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{pa.name || pa.username}</p>
                  <p className="truncate text-xs text-slate-400">{pa.email}</p>
                </div>
                <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                </span>
              </div>
              {pa.availabilitySince && (
                <p className="mt-3 text-xs text-slate-400">
                  Available since {format(new Date(pa.availabilitySince), "h:mm a")}
                </p>
              )}
              <Button
                onClick={() => setSelected(pa)}
                className="mt-4 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                <CalendarPlus className="mr-1.5 h-4 w-4" /> Book
              </Button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <BookingDialog
          pa={selected}
          onClose={() => setSelected(null)}
          onBooked={() => {
            setSelected(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function BookingDialog({ pa, onClose, onBooked }: { pa: PA; onClose: () => void; onBooked: () => void }) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [task, setTask] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!task.trim()) {
      setError("Please describe the task.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paId: pa.id, date, startTime, endTime, task }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to book")
      onBooked()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to book")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Book {pa.name || pa.username}</h2>
        <p className="mt-1 text-sm text-slate-500">Assign a time slot (9 AM–5 PM) and task.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Date</label>
            <input
              type="date"
              value={date}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Start</label>
              <input
                type="time"
                value={startTime}
                min="09:00"
                max="17:00"
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">End</label>
              <input
                type="time"
                value={endTime}
                min="09:00"
                max="17:00"
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Task details</label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              rows={3}
              placeholder="Describe what you need the PA to do…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      </div>
    </div>
  )
}
