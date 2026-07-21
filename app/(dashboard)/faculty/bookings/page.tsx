"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { Check, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  pa: { id: string; name: string | null; username: string; email: string }
}

const STATUS_STYLES: Record<Booking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  ABSENT: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
}

export default function FacultyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/bookings")
      const data = await res.json()
      if (res.ok) setBookings(data.bookings ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(id: string, status: "COMPLETED" | "ABSENT" | "CANCELLED") {
    setBusy(id)
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">My Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track PAs you booked. Mark a PA absent if they don&apos;t report for the slot.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Project Assistant</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">No bookings yet.</td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.pa.name || b.pa.username}</td>
                  <td className="px-4 py-3 text-slate-600">{format(new Date(b.date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(b.startTime), "h:mm a")}–{format(new Date(b.endTime), "h:mm a")}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{b.task}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[b.status])}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.status === "BOOKED" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === b.id}
                          onClick={() => updateStatus(b.id, "COMPLETED")}
                          className="cursor-pointer text-emerald-600 hover:bg-emerald-50"
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === b.id}
                          onClick={() => updateStatus(b.id, "ABSENT")}
                          className="cursor-pointer text-red-600 hover:bg-red-50"
                        >
                          <UserX className="mr-1 h-3.5 w-3.5" /> Absent
                        </Button>
                      </div>
                    ) : (
                      <span className="block text-right text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
