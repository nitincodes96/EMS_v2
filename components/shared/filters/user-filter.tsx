"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: new Date(0, i).toLocaleString("en", { month: "short" }),
}))
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i))

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
  filterUserType,
  filterMonth,
  filterYear,
  onOrgChange,
  onRoleChange,
  onUserTypeChange,
  onMonthChange,
  onYearChange,
  exportData,
  exportFilename,
}: {
  showOrgFilter?: boolean
  departments?: { id: string; name: string }[]
  filterOrg?: string
  filterRole: string
  filterUserType: string
  filterMonth: string
  filterYear: string
  onOrgChange?: (v: string) => void
  onRoleChange: (v: string) => void
  onUserTypeChange: (v: string) => void
  onMonthChange: (v: string) => void
  onYearChange: (v: string) => void
  exportData: Record<string, string | number>[]
  exportFilename: string
}) {
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
    <div className="flex flex-wrap items-center gap-1.5">
      {showOrgFilter && (
        <FilterBlock label="Department">
          <Select value={filterOrg ?? "all"} onValueChange={(v) => v && onOrgChange?.(v)}>
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
        <Select value={filterRole} onValueChange={(v) => v && onRoleChange(v)}>
          <SelectTrigger className="h-7 w-24 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="PROJECT_ASSISTANT">Project Assistant</SelectItem>
            <SelectItem value="FACULTY">Faculty</SelectItem>
          </SelectContent>
        </Select>
      </FilterBlock>
      <FilterBlock label="User Type">
        <Select value={filterUserType} onValueChange={(v) => v && onUserTypeChange(v)}>
          <SelectTrigger className="h-7 w-28 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
            <SelectItem value="INTERN">Intern</SelectItem>
            <SelectItem value="CONTRACTUAL">Contractual</SelectItem>
          </SelectContent>
        </Select>
      </FilterBlock>
      <FilterBlock label="Month">
        <Select value={filterMonth} onValueChange={(v) => v && onMonthChange(v)}>
          <SelectTrigger className="h-7 w-20 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Month</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBlock>
      <FilterBlock label="Year">
        <Select value={filterYear} onValueChange={(v) => v && onYearChange(v)}>
          <SelectTrigger className="h-7 w-20 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Year</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
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
