"use client"

import { useCallback, useEffect, useState } from "react"
import { Fingerprint, LogIn, LogOut, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Attendance = {
  checkedInAt: string | null
  checkedOutAt: string | null
  durationSoFar: string
  isOpen: boolean
  status: string
} | null

export function AttendancePanel() {
  const [attendance, setAttendance] = useState<Attendance>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch("/api/attendance/today")
    const data = await res.json()
    if (res.ok) setAttendance(data.attendance)
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  const isCheckedIn = !!attendance?.checkedInAt && !attendance?.checkedOutAt && attendance.isOpen

  async function punch() {
    setError(null)
    if (!navigator.geolocation) {
      setError("Geolocation is required to mark attendance.")
      return
    }
    setBusy(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })
      const endpoint = isCheckedIn ? "/api/attendance/check-out" : "/api/attendance/check-in"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Unable to update attendance")
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update attendance")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">Mark your attendance with device location.</p>
      </div>

      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Fingerprint className="h-5 w-5" />
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase",
              isCheckedIn ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
            )}
          >
            {loading ? "…" : attendance?.status || (isCheckedIn ? "Checked in" : "Not checked in")}
          </span>
        </div>

        <div className="mt-5 space-y-2 text-sm">
          <Row icon={<LogIn className="h-3.5 w-3.5" />} label="Checked in" value={attendance?.checkedInAt ?? "—"} />
          <Row icon={<LogOut className="h-3.5 w-3.5" />} label="Checked out" value={attendance?.checkedOutAt ?? "—"} />
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="flex items-center gap-1.5 text-slate-400"><Timer className="h-3.5 w-3.5" /> Duration</span>
            <span className="font-semibold text-indigo-600">
              {attendance?.durationSoFar ?? "0m"}
              {isCheckedIn && <span className="text-xs font-normal text-slate-400"> · ongoing</span>}
            </span>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <Button
          onClick={punch}
          disabled={busy || loading}
          className={cn(
            "mt-5 w-full rounded-xl px-3 py-5 text-sm font-semibold text-white shadow-md transition-all disabled:opacity-50 cursor-pointer",
            isCheckedIn ? "bg-slate-700 hover:bg-slate-800" : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          {isCheckedIn ? (
            <><LogOut className="mr-1.5 h-4 w-4" /> {busy ? "Checking out…" : "Check out"}</>
          ) : (
            <><LogIn className="mr-1.5 h-4 w-4" /> {busy ? "Checking in…" : "Check in"}</>
          )}
        </Button>

        <p className="mt-3 text-center text-xs text-slate-400">
          {isCheckedIn
            ? "You're checked in and available for booking today."
            : "Checking in also marks you available so faculty can book you."}
        </p>
      </div>
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-slate-400">{icon} {label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  )
}
