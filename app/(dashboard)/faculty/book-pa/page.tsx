"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { CalendarPlus, RefreshCw, Search, UserCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type PA = {
  id: string
  name: string | null
  username: string
  email: string
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((pa) => (
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
                {pa.isAvailable && (
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
                  </span>
                )}
              </div>
              {pa.isAvailable && pa.availabilitySince && (
                <p className="mt-3 text-xs text-slate-400">
                  Punched in since {format(new Date(pa.availabilitySince), "h:mm a")}
                </p>
              )}
              <Button
                onClick={() => router.push(`/faculty/book-pa/${pa.id}`)}
                className="mt-4 w-full rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
              >
                <CalendarPlus className="mr-1.5 h-4 w-4" /> Open calendar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
