"use client"

import { useMemo } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

type Option = { value: string; label: string }

/** Base UI renders the raw value in the trigger unless Root gets an items map. */
const toItems = (options: Option[]): Record<string, string> =>
  Object.fromEntries(options.map((o) => [o.value, o.label]))

const MONTH_OPTIONS: Option[] = [
  { value: "all", label: "Month" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(0, i).toLocaleString("en", { month: "long" }),
  })),
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS: Option[] = [
  { value: "all", label: "Year" },
  ...Array.from({ length: 5 }, (_, i) => {
    const year = String(CURRENT_YEAR - i)
    return { value: year, label: year }
  }),
]

// Moderators sit outside departments, so department-scoped rosters never list
// them. Only screens that span the whole organization opt the role in.
const ROLE_OPTIONS: Option[] = [
  { value: "all", label: "All Roles" },
  { value: "PROJECT_ASSISTANT", label: "Project Assistant" },
  { value: "FACULTY", label: "Faculty" },
]

const MODERATOR_ROLE_OPTION: Option = { value: "MODERATOR", label: "Moderator" }

const MONTH_ITEMS = toItems(MONTH_OPTIONS)
const YEAR_ITEMS = toItems(YEAR_OPTIONS)

function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return ""
  const headers = Object.keys(rows[0])
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
}

function FilterBlock({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  )
}

export function UserFilter({
  showOrgFilter = false,
  departments = [],
  filterOrg,
  filterRole,
  filterMonth,
  filterYear,
  onOrgChange,
  onRoleChange,
  onMonthChange,
  onYearChange,
  exportData,
  exportFilename,
  includeModerator = false,
}: {
  showOrgFilter?: boolean
  departments?: { id: string; name: string }[]
  /** Adds Moderator to the role options — only for organization-wide screens. */
  includeModerator?: boolean
  filterOrg?: string
  filterRole: string
  filterMonth: string
  filterYear: string
  onOrgChange?: (v: string) => void
  onRoleChange: (v: string) => void
  onMonthChange: (v: string) => void
  onYearChange: (v: string) => void
  exportData: Record<string, string | number>[]
  exportFilename: string
}) {
  const orgItems = useMemo(
    () => ({
      all: "All Departments",
      ...Object.fromEntries(departments.map((org) => [org.id, org.name])),
    }),
    [departments]
  )

  const roleOptions = useMemo(
    () => (includeModerator ? [...ROLE_OPTIONS, MODERATOR_ROLE_OPTION] : ROLE_OPTIONS),
    [includeModerator]
  )

  const roleItems = useMemo(() => toItems(roleOptions), [roleOptions])

  const handleExport = () => {
    const csv = toCsv(exportData)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${exportFilename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-wrap items-end gap-1.5">
      {showOrgFilter && (
        <FilterBlock label="Department">
          <Select
            items={orgItems}
            value={filterOrg ?? "all"}
            onValueChange={(v) => v && onOrgChange?.(String(v))}
          >
            <SelectTrigger className="h-7 w-32 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>
      )}
      <FilterBlock label="Role">
        <Select items={roleItems} value={filterRole} onValueChange={(v) => v && onRoleChange(String(v))}>
          <SelectTrigger className="h-7 w-32 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBlock>
      <FilterBlock label="Month">
        <Select items={MONTH_ITEMS} value={filterMonth} onValueChange={(v) => v && onMonthChange(String(v))}>
          <SelectTrigger className="h-7 w-30 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBlock>
      <FilterBlock label="Year">
        <Select items={YEAR_ITEMS} value={filterYear} onValueChange={(v) => v && onYearChange(String(v))}>
          <SelectTrigger className="h-7 w-20 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y.value} value={y.value}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBlock>
      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleExport}>
        <Download className="mr-1 h-3 w-3" />
        Export
      </Button>
    </div>
  )
}
