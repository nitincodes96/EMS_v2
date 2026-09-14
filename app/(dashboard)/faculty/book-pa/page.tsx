"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  AlertTriangle,
  CalendarPlus,
  CalendarSearch,
  ChevronRight,
  Mail,
  Phone,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { TablePagination } from "@/components/shared/table-pagination"
import { minutesToLabel } from "@/lib/booking-slots"
import { cn } from "@/lib/utils"

type Availability = {
  status: "free" | "booked" | "on-leave" | "unavailable"
  dayBookingCount: number
}

type PA = {
  id: string
  name: string | null
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
  unavailable: { label: "Unavailable", cls: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

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
  // Department-set cap on how many bookings this faculty can have open at once
  const [bookingLimit, setBookingLimit] = useState<{ limit: number; active: number } | null>(null)

  useEffect(() => {
    fetch("/api/departments/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const dept = d?.department
        if (dept?.shiftStartTime && dept?.shiftEndTime) {
          setWorkingHours({ start: dept.shiftStartTime, end: dept.shiftEndTime })
        }
        if (dept?.facultyActiveBookingCount != null) {
          setBookingLimit({ limit: dept.facultyBookingLimit ?? 0, active: dept.facultyActiveBookingCount })
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
        pa.email.toLowerCase().includes(q)
      )
    })
  }, [pas, search, filteringByDate, onlyAvailable])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  // Any change to the visible set should land back on page 1
  useEffect(() => {
    setPage(1)
  }, [search, filteringByDate, onlyAvailable, pas, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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

      {bookingLimit && bookingLimit.limit > 0 && (
        <div
          className={cn(
            "mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm",
            bookingLimit.active >= bookingLimit.limit
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-slate-200 bg-white text-slate-600"
          )}
        >
          {bookingLimit.active >= bookingLimit.limit && <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="flex-1">
            You have <span className="font-semibold">{bookingLimit.active}</span> of{" "}
            <span className="font-semibold">{bookingLimit.limit}</span> active bookings.
            {bookingLimit.active >= bookingLimit.limit
              ? " Complete or cancel one before booking another."
              : ""}
          </span>
          {bookingLimit.active >= bookingLimit.limit && (
            <Link
              href="/faculty/bookings"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
            >
              Go to My Bookings <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

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
          {/* Date Input */}
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

          <div className="flex items-end gap-3">
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
            placeholder="Search by name or email…"
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-180 text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Project Assistant</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">
                    {filteringByDate ? "Availability for selected day" : "Today's Availability"}
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((pa) => {
                  const badge = filteringByDate && pa.availability ? AVAILABILITY_BADGE[pa.availability.status] : null
                  return (
                    <tr key={pa.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      {/* Identity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <EntityAvatar
                              name={pa.name}
                              fallbackText={pa.email}
                              imageUrl={pa.photoUrl}
                              className="h-9 w-9 ring-2 ring-slate-100"
                            />
                            <span
                              className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
                                pa.isAvailable ? "bg-emerald-500" : "bg-slate-300"
                              )}
                              title={pa.isAvailable ? "Available now" : "Not punched in today"}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{pa.name || pa.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <a
                          href={`mailto:${pa.email}`}
                          className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-indigo-600"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{pa.email}</span>
                        </a>
                        {pa.phoneNumber ? (
                          <a
                            href={`tel:${pa.phoneNumber}`}
                            className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-indigo-600"
                          >
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{pa.phoneNumber}</span>
                          </a>
                        ) : (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-300">
                            <Phone className="h-3.5 w-3.5 shrink-0" /> No phone on file
                          </p>
                        )}
                      </td>

                      {/* Availability */}
                      <td className="whitespace-nowrap px-4 py-3">
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
                        {filteringByDate ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {pa.availability?.dayBookingCount
                              ? `${pa.availability.dayBookingCount} booking${pa.availability.dayBookingCount > 1 ? "s" : ""} that day`
                              : "No bookings that day"}
                          </p>
                        ) : pa.isAvailable ? (
                          <p className="text-[11px] font-medium text-emerald-600">
                            {pa.availabilitySince
                              ? `Available since ${format(new Date(pa.availabilitySince), "h:mm a")}`
                              : "Available now"}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400">Not punched in today</p>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          onClick={() => router.push(`/faculty/book-pa/${pa.id}${date ? `?date=${date}` : ""}`)}
                          className="cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          <CalendarPlus className="mr-1.5 h-4 w-4" /> Open calendar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  )
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}
