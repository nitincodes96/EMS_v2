"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TablePagination } from "@/components/shared/table-pagination"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"

type Category = "AUTH" | "USER" | "DEPARTMENT" | "BOOKING" | "LEAVE"

type SystemLog = {
  id: string
  category: Category
  action: string
  description: string
  actorLabel: string | null
  actorRole: string | null
  departmentName: string | null
  createdAt: string
  actor: { id: string; name: string | null; email: string | null; photoUrl: string | null } | null
}

type Department = { id: string; name: string }

const PAGE_SIZE_OPTIONS = [25, 50, 100]

const FILTERS = [
  { key: "all", label: "All", icon: ScrollText },
  { key: "AUTH", label: "Auth", icon: ShieldCheck },
  { key: "USER", label: "Users", icon: Users },
  { key: "DEPARTMENT", label: "Departments", icon: Building2 },
  { key: "BOOKING", label: "Bookings", icon: ClipboardList },
  { key: "LEAVE", label: "Leave", icon: CalendarCheck },
] as const

const CATEGORY_STYLES: Record<Category, string> = {
  AUTH: "bg-violet-50 text-violet-600",
  USER: "bg-sky-50 text-sky-600",
  DEPARTMENT: "bg-amber-50 text-amber-700",
  BOOKING: "bg-indigo-50 text-indigo-600",
  LEAVE: "bg-emerald-50 text-emerald-600",
}

/** "PROJECT_ASSISTANT" -> "Project Assistant" */
function roleLabel(role: string | null) {
  if (!role) return null
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [counts, setCounts] = useState<Partial<Record<Category, number>>>({})
  const [loading, setLoading] = useState(true)

  const [category, setCategory] = useState<string>("all")
  const [departmentId, setDepartmentId] = useState("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [total, setTotal] = useState(0)

  // Debounce typing so we don't refetch on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize) })
      if (category !== "all") params.set("category", category)
      if (departmentId !== "all") params.set("departmentId", departmentId)
      if (debouncedSearch) params.set("q", debouncedSearch)
      if (from) params.set("from", from)
      if (to) params.set("to", to)

      const res = await fetch(`/api/admin/logs?${params}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs ?? [])
        setTotal(data.pagination?.total ?? 0)
        setCounts(data.counts ?? {})
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, category, departmentId, debouncedSearch, from, to])

  useEffect(() => {
    void load()
  }, [load])

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">System Logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every action taken across the site — who did it, what changed, and when.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="cursor-pointer">
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {FILTERS.map((f) => {
          const count = f.key === "all" ? undefined : counts[f.key as Category]
          const Icon = f.icon
          return (
            <button
              key={f.key}
              onClick={() => resetToFirstPage(setCategory)(f.key)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                category === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {f.label}
              {count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                    category === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, description or person…"
            className="rounded-lg pl-9"
          />
        </div>

        <select
          value={departmentId}
          onChange={(e) => resetToFirstPage(setDepartmentId)(e.target.value)}
          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <label htmlFor="log-from" className="text-xs font-medium uppercase tracking-wide text-slate-400">
            From
          </label>
          <Input
            id="log-from"
            type="date"
            value={from}
            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
            className="w-40 rounded-lg"
          />
          <label htmlFor="log-to" className="text-xs font-medium uppercase tracking-wide text-slate-400">
            To
          </label>
          <Input
            id="log-to"
            type="date"
            value={to}
            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
            className="w-40 rounded-lg"
          />
        </div>
      </div>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 p-5">
          <ScrollText className="h-4 w-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900">Activity</h2>
          <span className="ml-auto text-sm text-slate-400">{total} events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Time</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Performed by</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No events match these filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                      <p className="font-medium text-slate-700">
                        {format(new Date(log.createdAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(log.createdAt), "h:mm:ss a")}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          CATEGORY_STYLES[log.category]
                        )}
                      >
                        {log.category}
                      </span>
                      <p className="mt-1 font-medium text-slate-900">{log.action}</p>
                    </td>
                    <td className="max-w-md px-5 py-3 text-slate-600">
                      <p>{log.description}</p>
                      {log.departmentName && (
                        <p className="mt-0.5 text-xs text-slate-400">{log.departmentName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.actorLabel ? (
                        <div className="flex items-center gap-2">
                          <EntityAvatar
                            name={log.actorLabel}
                            imageUrl={log.actor?.photoUrl ?? null}
                            size="sm"
                            className="h-7 w-7 shrink-0"
                          />
                          <div>
                            <p className="font-medium text-slate-900">{log.actorLabel}</p>
                            {log.actorRole && (
                              <p className="text-xs text-slate-400">{roleLabel(log.actorRole)}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">System</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>
    </div>
  )
}
