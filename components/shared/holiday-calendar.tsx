"use client"

import { useMemo } from "react"
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, format } from "date-fns"
import { cn } from "@/lib/utils"

interface Holiday {
  id: string
  name: string
  date: string
  type: "NATIONAL" | "RELIGIOUS" | "CUSTOM"
}

const TYPE_DOT: Record<Holiday["type"], string> = {
  NATIONAL: "bg-indigo-500",
  RELIGIOUS: "bg-amber-500",
  CUSTOM: "bg-slate-400",
}

export function HolidayCalendar({
  holidays,
  size = "full",
}: {
  holidays: Holiday[]
  size?: "compact" | "full"
}) {
  const today = new Date()
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(today), end: endOfMonth(today) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const leadingBlanks = getDay(startOfMonth(today))
  const cell = size === "compact" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {format(today, "MMMM yyyy")}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`b${i}`} className={cell} />
        ))}
        {days.map((day) => {
          const holiday = holidays.find((h) => isSameDay(new Date(h.date), day))
          return (
            <div
              key={day.toISOString()}
              title={holiday?.name}
              className={cn(
                "flex items-center justify-center rounded-md",
                cell,
                holiday ? cn(TYPE_DOT[holiday.type], "font-semibold text-white") : "text-slate-500"
              )}
            >
              {day.getDate()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
