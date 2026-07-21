"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"

type Booking = {
  id: string
  date: string
  startTime: string
  endTime: string
  task: string
  status: "BOOKED" | "COMPLETED" | "ABSENT" | "CANCELLED"
  faculty: { id: string; name: string | null; username: string }
  pa: { id: string; name: string | null; username: string }
  department: { id: string; name: string }
}

const STATUS_STYLES: Record<Booking["status"], string> = {
  BOOKED: "bg-indigo-50 text-indigo-600",
  COMPLETED: "bg-emerald-50 text-emerald-600",
  ABSENT: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings ?? []))
      .finally(() => setLoading(false))
  }, [])

  const absentCount = bookings.filter((b) => b.status === "ABSENT").length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bookings</h1>
        <p className="mt-1 text-sm text-slate-500">
          PA slot-booking history across departments, with absence markings.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total" value={bookings.length} />
        <Stat label="Booked" value={bookings.filter((b) => b.status === "BOOKED").length} />
        <Stat label="Completed" value={bookings.filter((b) => b.status === "COMPLETED").length} />
        <Stat label="Absent" value={absentCount} accent="text-red-600" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Faculty</th>
              <th className="px-4 py-3">PA</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Slot</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No bookings yet.</td></tr>
            ) : (
              bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{b.faculty.name || b.faculty.username}</td>
                  <td className="px-4 py-3 text-slate-600">{b.pa.name || b.pa.username}</td>
                  <td className="px-4 py-3 text-slate-600">{b.department.name}</td>
                  <td className="px-4 py-3 text-slate-600">{format(new Date(b.date), "MMM d, yyyy")}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {format(new Date(b.startTime), "h:mm a")}–{format(new Date(b.endTime), "h:mm a")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[b.status])}>
                      {b.status}
                    </span>
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold text-slate-900", accent)}>{value}</p>
    </div>
  )
}
