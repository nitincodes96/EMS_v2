"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { GraduationCap, Users, UserSquare2 } from "lucide-react"
import { useSession } from "next-auth/react"

import { EntityAvatar } from "@/components/shared/entity-avatar"
import { UserFilter } from "@/components/shared/filters/user-filter"
import { PageHeader } from "@/components/shared/page-header"
import { TablePagination } from "@/components/shared/table-pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { User } from "@/types"

const PAGE_SIZE = 8

// ---------------------------------------------------------------------------
// Role / status presentation
// ---------------------------------------------------------------------------

const ROLE_LABEL: Record<User["role"], string> = {
  PROJECT_ASSISTANT: "Project Assistant",
  FACULTY: "Faculty",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
}

const ROLE_STYLES: Record<User["role"], string> = {
  PROJECT_ASSISTANT: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
  FACULTY: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
  ADMIN: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60",
  MODERATOR: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
}

/** Faculty first, then PAs — matches how the department roster is usually read. */
const ROLE_RANK: Record<User["role"], number> = {
  ADMIN: 0,
  MODERATOR: 1,
  FACULTY: 2,
  PROJECT_ASSISTANT: 3,
}

type MemberStatus = { label: string; className: string }

function statusOf(user: User): MemberStatus {
  if (!user.isActive) {
    return { label: "Inactive", className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/60" }
  }
  if (user.status === "INVITED") {
    return { label: "Invited", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" }
  }
  return { label: "Active", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" }
}

/** joiningDate is optional in the schema, so fall back to the account creation date. */
function joinedAt(user: User): Date | null {
  const raw = user.joiningDate || user.createdAt
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function joinedOn(user: User): string {
  const parsed = joinedAt(user)
  return parsed ? format(parsed, "MMM d, yyyy") : "—"
}

// ---------------------------------------------------------------------------
// Roster — shared by the Faculty and Project Assistant team pages.
// /api/users scopes the result to the caller's own department and returns both
// Faculty and Project Assistants, so the same view serves either role.
// ---------------------------------------------------------------------------

export function TeamRoster({
  description,
  scope = "department",
}: {
  description?: (scopeName: string) => string
  /**
   * "department" — the caller's own department (Faculty, Project Assistant).
   * "organization" — every department, with a department column and filter (Moderator).
   */
  scope?: "department" | "organization"
}) {
  const { data: session, status: sessionStatus } = useSession()
  const isOrgScope = scope === "organization"

  const [members, setMembers] = useState<User[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [departmentName, setDepartmentName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterOrg, setFilterOrg] = useState("all")
  const [filterRole, setFilterRole] = useState("all")
  const [filterMonth, setFilterMonth] = useState("all")
  const [filterYear, setFilterYear] = useState("all")
  const [page, setPage] = useState(1)

  const currentUserId = session?.user?.id

  useEffect(() => {
    if (sessionStatus === "loading") return

    let active = true

    const loadTeam = async () => {
      setLoading(true)
      try {
        // The API scopes /api/users by role: own department for Faculty and PAs,
        // organization-wide for Moderators.
        const [usersResponse, scopeResponse] = await Promise.all([
          fetch("/api/users"),
          fetch(isOrgScope ? "/api/departments" : "/api/departments/me"),
        ])

        const usersData = await usersResponse.json()
        const scopeData = await scopeResponse.json()

        if (!active) return

        if (!usersResponse.ok) {
          throw new Error(usersData?.error || "Unable to load members")
        }

        setMembers(usersData.users || [])

        if (scopeResponse.ok) {
          if (isOrgScope) {
            setDepartments(
              (scopeData.departments || []).map((d: { id: string; name: string }) => ({
                id: d.id,
                name: d.name,
              }))
            )
          } else if (scopeData?.department) {
            setDepartmentName(scopeData.department.name)
          }
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your team")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadTeam()

    return () => {
      active = false
    }
  }, [sessionStatus, isOrgScope])

  const stats = useMemo(
    () => ({
      total: members.length,
      projectAssistants: members.filter((m) => m.role === "PROJECT_ASSISTANT").length,
      faculty: members.filter((m) => m.role === "FACULTY").length,
    }),
    [members]
  )

  // Month/year filter the joining date. You always sit at the top of your own roster.
  const rows = useMemo(
    () =>
      members
        .filter((member) => {
          if (filterOrg !== "all" && member.departmentId !== filterOrg) return false
          if (filterRole !== "all" && member.role !== filterRole) return false
          if (filterMonth === "all" && filterYear === "all") return true
          const joined = joinedAt(member)
          if (!joined) return false
          if (filterMonth !== "all" && joined.getMonth() + 1 !== Number(filterMonth)) return false
          if (filterYear !== "all" && joined.getFullYear() !== Number(filterYear)) return false
          return true
        })
        .sort((a, b) => {
          if (a.id === currentUserId) return -1
          if (b.id === currentUserId) return 1
          return (
            ROLE_RANK[a.role] - ROLE_RANK[b.role] ||
            (a.name || a.email || "").localeCompare(b.name || b.email || "")
          )
        }),
    [members, currentUserId, filterOrg, filterRole, filterMonth, filterYear]
  )

  // Clamp against a page a filter change may have left out of range.
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)))
  const pagedRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Export follows the filters, so you get exactly the list you are looking at.
  const exportData = useMemo(
    () =>
      rows.map((member) => ({
        Name: member.name || member.empCode || "Unnamed",
        Email: member.email || "—",
        Role: ROLE_LABEL[member.role],
        ...(isOrgScope ? { Department: member.department?.name || "—" } : {}),
        Status: statusOf(member).label,
        "Joining date": joinedOn(member),
      })),
    [rows, isOrgScope]
  )

  const handleOrgChange = (value: string) => {
    setFilterOrg(value)
    setPage(1)
  }

  const handleRoleChange = (value: string) => {
    setFilterRole(value)
    setPage(1)
  }

  const handleMonthChange = (value: string) => {
    setFilterMonth(value)
    setPage(1)
  }

  const handleYearChange = (value: string) => {
    setFilterYear(value)
    setPage(1)
  }

  const scopeName = isOrgScope ? "the organization" : departmentName || "your department"
  const resolveDescription = (name: string) =>
    description?.(name) ?? `Everyone in ${name} — the faculty and project assistants you work with.`

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title="Team" description={resolveDescription(scopeName)} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Headcount */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          accent="bg-slate-100 text-slate-700 ring-slate-200"
          label="Total People"
          value={stats.total}
          loading={loading}
        />
        <StatCard
          icon={<UserSquare2 className="h-5 w-5" />}
          accent="bg-indigo-50 text-indigo-600 ring-indigo-100"
          label="Project Assistants"
          value={stats.projectAssistants}
          loading={loading}
        />
        <StatCard
          icon={<GraduationCap className="h-5 w-5" />}
          accent="bg-violet-50 text-violet-600 ring-violet-100"
          label="Faculty"
          value={stats.faculty}
          loading={loading}
        />
      </div>

      {/* Roster */}
      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Users className="h-4 w-4 text-indigo-600" />{" "}
              {isOrgScope ? "Organization members" : "Department members"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              View-only — reach out to an admin to correct anything listed here.
            </p>
          </div>

          <UserFilter
            showOrgFilter={isOrgScope}
            includeModerator={isOrgScope}
            departments={departments}
            filterOrg={filterOrg}
            filterRole={filterRole}
            filterMonth={filterMonth}
            filterYear={filterYear}
            onOrgChange={handleOrgChange}
            onRoleChange={handleRoleChange}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
            exportData={exportData}
            exportFilename={`team-${(isOrgScope ? "organization" : departmentName) || "department"}`}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                {isOrgScope && <th className="px-5 py-3">Department</th>}
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Joining date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3.5 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-28 rounded-full" />
                    </td>
                    {isOrgScope && (
                      <td className="px-5 py-3">
                        <Skeleton className="h-3.5 w-24" />
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-3.5 w-24" />
                    </td>
                  </tr>
                ))
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={isOrgScope ? 5 : 4} className="px-5 py-10 text-center text-slate-400">
                    {members.length === 0
                      ? isOrgScope
                        ? "No members listed in the organization yet."
                        : "No one is listed in your department yet."
                      : "No members match these filters."}
                  </td>
                </tr>
              ) : (
                pagedRows.map((member) => {
                  const isMe = member.id === currentUserId
                  const status = statusOf(member)

                  return (
                    <tr
                      key={member.id}
                      className={cn(
                        "border-b border-slate-50 last:border-0",
                        isMe && "bg-indigo-50/40"
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <EntityAvatar
                            name={member.name}
                            fallbackText={member.email || member.empCode}
                            imageUrl={member.photoUrl}
                            className="h-9 w-9 shrink-0 border border-slate-200"
                          />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium text-slate-900">
                              <span className="truncate">
                                {member.name || member.empCode || "Unnamed"}
                              </span>
                              {isMe && (
                                <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                                  Me
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-400">
                              {member.email || member.empCode || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            ROLE_STYLES[member.role]
                          )}
                        >
                          {ROLE_LABEL[member.role]}
                        </span>
                      </td>
                      {isOrgScope && (
                        <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                          {member.department?.name || "—"}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {joinedOn(member)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={rows.length}
            onPageChange={setPage}
          />
        )}
      </section>
    </div>
  )
}

function StatCard({
  icon,
  accent,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: number
  loading?: boolean
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
          accent
        )}
      >
        {icon}
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-8 w-10" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        )}
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  )
}
