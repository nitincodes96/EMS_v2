"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarPlus, CalendarSearch, Mail, Phone, RefreshCw, Search, UserCheck, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { minutesToLabel } from "@/lib/booking-slots"
import { cn } from "@/lib/utils"

type Availability = {
  status: "free" | "booked" | "on-leave"
  dayBookingCount: number
}

type PA = {
  id: string
  name: string | null
  username: string
  email: string
  phoneNumber: string | null
  photoUrl: string | null
  isAvailable: boolean
  availabilitySince: string | null
  department: { id: string; name: string } | null
  availability?: Availability
}

function toHHMM(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
}

function parseHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Whole-hour marks between the department's working start and end. */
function buildHourMarks(startHHMM: string, endHHMM: string) {
  const start = parseHHMM(startHHMM)
  const end = parseHHMM(endHHMM)
  const out: number[] = []
  for (let m = start; m <= end; m += 60) out.push(m)
  return out
}

const AVAILABILITY_BADGE: Record<Availability["status"], { label: string; cls: string; dot: string }> = {
  free: { label: "Free", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  booked: { label: "Booked", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  "on-leave": { label: "On leave", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
}

export default function BookPAPage() {
  const router = useRouter()
  const [pas, setPas] = useState<PA[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Availability filter
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  // Working hours drive the slot dropdown, from the department (not hardcoded)
  const [workingHours, setWorkingHours] = useState({ start: "09:00", end: "18:00" })

  useEffect(() => {
    fetch("/api/departments/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const dept = d?.department
        if (dept?.shiftStartTime && dept?.shiftEndTime) {
          setWorkingHours({ start: dept.shiftStartTime, end: dept.shiftEndTime })
        }
      })
      .catch(() => {})
  }, [])

  const HOURS = useMemo(() => buildHourMarks(workingHours.start, workingHours.end), [workingHours])

  const hasSlot = Boolean(startTime && endTime && startTime < endTime)
  const filteringByDate = Boolean(date)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (date) {
        params.set("date", date)
        if (hasSlot) {
          params.set("startTime", startTime)
          params.set("endTime", endTime)
        }
      }
      const res = await fetch(`/api/pas${params.toString() ? `?${params}` : ""}`)
      const data = await res.json()
      if (res.ok) setPas(data.pas ?? [])
    } finally {
      setLoading(false)
    }
  }, [date, startTime, endTime, hasSlot])

  useEffect(() => {
    void load()
  }, [load])

  function clearAvailability() {
    setDate("")
    setStartTime("")
    setEndTime("")
    setOnlyAvailable(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pas.filter((pa) => {
      if (filteringByDate && onlyAvailable && pa.availability?.status !== "free") return false
      if (!filteringByDate && onlyAvailable && !pa.isAvailable) return false
      if (!q) return true
      return (
        (pa.name || "").toLowerCase().includes(q) ||
        pa.username.toLowerCase().includes(q) ||
        pa.email.toLowerCase().includes(q)
      )
    })
  }, [pas, search, filteringByDate, onlyAvailable])

  const slotLabel = hasSlot ? `${minutesToLabel(toMinutes(startTime))} – ${minutesToLabel(toMinutes(endTime))}` : null

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Book a Project Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a PA to open their calendar, or filter by a day and slot to see who&apos;s free.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Availability filter */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CalendarSearch className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-slate-900">Find PAs free on a day or slot</h2>
          {filteringByDate && (
            <button
              onClick={clearAvailability}
              className="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500">Date</label>
            <input
              type="date"
              value={date}
              min={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500">From</label>
            <select
              value={startTime}
              disabled={!filteringByDate}
              onChange={(e) => {
                const v = e.target.value
                setStartTime(v)
                if (endTime && v >= endTime) setEndTime("")
              }}
              className="mt-1 block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Any</option>
              {HOURS.slice(0, -1).map((m) => (
                <option key={m} value={toHHMM(m)}>
                  {minutesToLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500">To</label>
            <select
              value={endTime}
              disabled={!filteringByDate || !startTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Any</option>
              {HOURS.filter((m) => !startTime || m > toMinutes(startTime)).map((m) => (
                <option key={m} value={toHHMM(m)}>
                  {minutesToLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm",
              onlyAvailable ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
            )}
          >
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="cursor-pointer accent-indigo-600"
            />
            {filteringByDate ? "Only free" : "Punched in now"}
          </label>
        </div>

        {filteringByDate && (
          <p className="mt-3 text-xs text-slate-500">
            Showing availability for{" "}
            <span className="font-medium text-slate-700">{format(new Date(date), "EEE, MMM d")}</span>
            {slotLabel ? (
              <>
                {" "}
                · <span className="font-medium text-slate-700">{slotLabel}</span>
              </>
            ) : (
              " (whole day)"
            )}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username or email…"
            className="rounded-lg pl-9"
          />
        </div>
      </div>

      {loading && pas.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading PAs…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No Project Assistants match</p>
          <p className="text-xs text-slate-400">
            {filteringByDate ? "Try a different day, slot, or clear the filter." : "Try clearing the search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pa) => {
            const badge = filteringByDate && pa.availability ? AVAILABILITY_BADGE[pa.availability.status] : null
            return (
              <div
                key={pa.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
              >
                {/* Identity */}
                <div className="flex items-start gap-3 p-4">
                  <div className="relative shrink-0">
                    <EntityAvatar
                      name={pa.name || pa.username}
                      fallbackText={pa.name || pa.username}
                      imageUrl={pa.photoUrl}
                      className="h-12 w-12 ring-2 ring-slate-100"
                    />
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white",
                        pa.isAvailable ? "bg-emerald-500" : "bg-slate-300"
                      )}
                      title={pa.isAvailable ? "Available now" : "Not punched in today"}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{pa.name || pa.username}</p>
                      {badge && (
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            badge.cls
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">@{pa.username}</p>
                    {filteringByDate ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {pa.availability?.dayBookingCount
                          ? `${pa.availability.dayBookingCount} booking${pa.availability.dayBookingCount > 1 ? "s" : ""} that day`
                          : "No bookings that day"}
                      </p>
                    ) : pa.isAvailable ? (
                      <p className="mt-1 text-[11px] font-medium text-emerald-600">
                        {pa.availabilitySince
                          ? `Available since ${format(new Date(pa.availabilitySince), "h:mm a")}`
                          : "Available now"}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">Not punched in today</p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-1.5 border-t border-slate-100 px-4 py-3">
                  <a
                    href={`mailto:${pa.email}`}
                    className="flex items-center gap-2 text-xs text-slate-500 transition-colors hover:text-indigo-600"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{pa.email}</span>
                  </a>

                  {pa.phoneNumber ? (
                    <a
                      href={`tel:${pa.phoneNumber}`}
                      className="flex items-center gap-2 text-xs font-medium text-slate-600 transition-colors hover:text-indigo-600"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{pa.phoneNumber}</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-xs text-slate-300">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> No phone on file
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="mt-auto border-t border-slate-100 p-3">
                  <Button
                    onClick={() =>
                      router.push(`/faculty/book-pa/${pa.id}${date ? `?date=${date}` : ""}`)
                    }
                    className="w-full cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" /> Open calendar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
