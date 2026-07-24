"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarPlus, Mail, Phone, RefreshCw, Search, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

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
}

type StatusFilter = "all" | "available"

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available today" },
]

export default function BookPAPage() {
  const router = useRouter()
  const [pas, setPas] = useState<PA[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/pas")
      const data = await res.json()
      if (res.ok) setPas(data.pas ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pas.filter((pa) => {
      if (statusFilter === "available" && !pa.isAvailable) return false
      if (!q) return true
      return (
        (pa.name || "").toLowerCase().includes(q) ||
        pa.username.toLowerCase().includes(q) ||
        pa.email.toLowerCase().includes(q)
      )
    })
  }, [pas, search, statusFilter])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Book a Project Assistant</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a PA to open their calendar and reserve continuous hourly slots.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Search + filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-55">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username or email…"
            className="pl-9 rounded-lg"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === f.value ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && pas.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading PAs…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No Project Assistants match</p>
          <p className="text-xs text-slate-400">Try clearing the search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pa) => (
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
                  <p className="truncate text-sm font-semibold text-slate-900">{pa.name || pa.username}</p>
                  <p className="truncate text-xs text-slate-400">@{pa.username}</p>
                  {pa.isAvailable ? (
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
                  onClick={() => router.push(`/faculty/book-pa/${pa.id}`)}
                  className="w-full cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <CalendarPlus className="mr-1.5 h-4 w-4" /> Open calendar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
