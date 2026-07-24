"use client"

import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

/** Shared status vocabulary for attendance rows, matching the dashboard badges. */
export type AttendanceStatusFilter = "all" | "on-time" | "late" | "absent"

type Option = { value: string; label: string }

/** Base UI renders the raw value in the trigger unless Root gets an items map. */
const toItems = (options: Option[]): Record<string, string> =>
  Object.fromEntries(options.map((o) => [o.value, o.label]))

const CURRENT_YEAR = new Date().getFullYear()

const MONTH_OPTIONS: Option[] = [
  { value: "all", label: "All months" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(0, i).toLocaleString("en", { month: "long" }),
  })),
]

const YEAR_OPTIONS: Option[] = [
  { value: "all", label: "All years" },
  ...Array.from({ length: 5 }, (_, i) => {
    const year = String(CURRENT_YEAR - i)
    return { value: year, label: year }
  }),
]

const STATUS_OPTIONS: Option[] = [
  { value: "all", label: "All statuses" },
  { value: "on-time", label: "On time" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
]

const MONTH_ITEMS = toItems(MONTH_OPTIONS)
const YEAR_ITEMS = toItems(YEAR_OPTIONS)
const STATUS_ITEMS = toItems(STATUS_OPTIONS)

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </div>
  )
}

export function AttendanceFilter({
  filterMonth,
  filterYear,
  filterStatus,
  onMonthChange,
  onYearChange,
  onStatusChange,
  onReset,
  className,
}: {
  filterMonth: string
  filterYear: string
  filterStatus: AttendanceStatusFilter
  onMonthChange: (v: string) => void
  onYearChange: (v: string) => void
  onStatusChange: (v: AttendanceStatusFilter) => void
  onReset?: () => void
  className?: string
}) {
  const isFiltered = filterMonth !== "all" || filterYear !== "all" || filterStatus !== "all"

  return (
    <div className={cn("flex flex-wrap items-end gap-1.5", className)}>
      <FilterBlock label="Month">
        <Select
          items={MONTH_ITEMS}
          value={filterMonth}
          onValueChange={(v) => v && onMonthChange(String(v))}
        >
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
        <Select
          items={YEAR_ITEMS}
          value={filterYear}
          onValueChange={(v) => v && onYearChange(String(v))}
        >
          <SelectTrigger className="h-7 w-24 text-[11px]">
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

      <FilterBlock label="Status">
        <Select
          items={STATUS_ITEMS}
          value={filterStatus}
          onValueChange={(v) => v && onStatusChange(v as AttendanceStatusFilter)}
        >
          <SelectTrigger className="h-7 w-28 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBlock>

      {isFiltered && onReset && (
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onReset}>
          <RotateCcw className="mr-1 h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  )
}
