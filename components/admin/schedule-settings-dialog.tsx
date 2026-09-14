"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Clock } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { DEFAULT_SLOT_MINUTES, SLOT_DURATION_OPTIONS, formatDuration } from "@/lib/booking-slots"
import { WorkTypesEditor } from "@/components/admin/work-types-editor"

/**
 * Organization-wide work schedule and booking rules. There is one set of
 * these for every department, edited from the Departments page.
 */

export type ScheduleSettings = {
  workingDays: string
  shiftStartTime: string
  shiftEndTime: string
  lunchStartTime: string | null
  lunchEndTime: string | null
  lateGraceMinutes: number
  bookingEnabled: boolean
  facultyBookingLimit: number
  maxSlotsPerBooking: number
  slotDurationMinutes: number
  bookingHorizonDays: number
  bookingChangeCutoffMinutes: number
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const GRACE_OPTIONS = [
  { label: "2 min", value: 2 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "30 min", value: 30 },
]

// Base UI's <SelectValue /> renders the raw value unless Root gets an items
// map, so supply value -> label for the slot-duration dropdown.
const SLOT_DURATION_ITEMS: Record<string, string> = Object.fromEntries(
  SLOT_DURATION_OPTIONS.map((m) => [String(m), formatDuration(m)])
)

type FormState = {
  workingDays: string[]
  shiftStartTime: string
  shiftEndTime: string
  lunchStartTime: string
  lunchEndTime: string
  lateGraceMinutes: number
  bookingEnabled: boolean
  facultyBookingLimit: number
  maxSlotsPerBooking: number
  slotDurationMinutes: number
  bookingHorizonDays: number
  bookingChangeCutoffMinutes: number
}

function toForm(s: ScheduleSettings): FormState {
  return {
    workingDays: s.workingDays ? s.workingDays.split(",").map((d) => d.trim()).filter(Boolean) : [],
    shiftStartTime: s.shiftStartTime,
    shiftEndTime: s.shiftEndTime,
    lunchStartTime: s.lunchStartTime ?? "",
    lunchEndTime: s.lunchEndTime ?? "",
    lateGraceMinutes: s.lateGraceMinutes,
    bookingEnabled: s.bookingEnabled,
    facultyBookingLimit: s.facultyBookingLimit,
    maxSlotsPerBooking: s.maxSlotsPerBooking,
    slotDurationMinutes: s.slotDurationMinutes ?? DEFAULT_SLOT_MINUTES,
    bookingHorizonDays: s.bookingHorizonDays,
    bookingChangeCutoffMinutes: s.bookingChangeCutoffMinutes,
  }
}

export function ScheduleSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (settings: ScheduleSettings) => void
}) {
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const r = await fetch("/api/settings/schedule")
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || "Failed to load schedule settings")
      setForm(toForm(data.settings))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedule settings")
    } finally {
      setLoading(false)
    }
  }, [])

  // Re-fetch each time the dialog opens so it always shows what's saved
  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const toggleDay = (day: string) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            workingDays: prev.workingDays.includes(day)
              ? prev.workingDays.filter((d) => d !== day)
              : [...prev.workingDays, day],
          }
        : prev
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (form.workingDays.length === 0) {
      setError("Select at least one working day")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/settings/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          workingDays: form.workingDays.join(","),
          lunchStartTime: form.lunchStartTime || null,
          lunchEndTime: form.lunchEndTime || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to save schedule settings")
        return
      }
      toast.success("Schedule settings saved for all departments")
      onSaved?.(data.settings)
      onOpenChange(false)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-h-[90vh] gap-0 overflow-hidden bg-white p-0 sm:max-w-xl">
        <DialogHeader className="px-5 pb-0 pt-5">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Clock className="h-4 w-4 text-indigo-600" /> Schedule settings
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Working hours, slot length, booking limits and work types. These apply to every department.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex max-h-[calc(90vh-80px)] flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {loading || !form ? (
              <div className="flex min-h-56 items-center justify-center">
                {error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Working days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "cursor-pointer rounded-lg border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors",
                          form.workingDays.includes(day)
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-500"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sched-shift-start">Shift start</Label>
                    <Input
                      id="sched-shift-start"
                      type="time"
                      value={form.shiftStartTime}
                      onChange={(e) => set("shiftStartTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sched-shift-end">Shift end</Label>
                    <Input
                      id="sched-shift-end"
                      type="time"
                      value={form.shiftEndTime}
                      onChange={(e) => set("shiftEndTime", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>
                      Lunch break <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    {(form.lunchStartTime || form.lunchEndTime) && (
                      <button
                        type="button"
                        onClick={() => {
                          set("lunchStartTime", "")
                          set("lunchEndTime", "")
                        }}
                        className="cursor-pointer text-xs font-medium text-slate-500 hover:text-red-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      aria-label="Lunch start"
                      type="time"
                      value={form.lunchStartTime}
                      onChange={(e) => set("lunchStartTime", e.target.value)}
                    />
                    <Input
                      aria-label="Lunch end"
                      type="time"
                      value={form.lunchEndTime}
                      onChange={(e) => set("lunchEndTime", e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-400">Slots during this break won&apos;t be bookable.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-grace">Late grace window</Label>
                  <Select
                    value={String(form.lateGraceMinutes)}
                    onValueChange={(v) => set("lateGraceMinutes", parseInt(v ?? "5"))}
                  >
                    <SelectTrigger id="sched-grace" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRACE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Check-ins within this window after shift start won&apos;t be marked late.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Booking rules</p>

                  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div>
                      <Label className="text-sm">Allow PA bookings</Label>
                      <p className="mt-0.5 text-xs text-slate-500">
                        When off, faculty can view PAs but can&apos;t book new slots.
                      </p>
                    </div>
                    <Switch
                      checked={form.bookingEnabled}
                      onCheckedChange={(checked: boolean) => set("bookingEnabled", checked)}
                      className="mt-0.5 shrink-0 data-checked:bg-indigo-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-slot-duration">Booking slot duration</Label>
                  <Select
                    items={SLOT_DURATION_ITEMS}
                    value={String(form.slotDurationMinutes ?? DEFAULT_SLOT_MINUTES)}
                    onValueChange={(v) => set("slotDurationMinutes", parseInt(String(v ?? DEFAULT_SLOT_MINUTES)))}
                  >
                    <SelectTrigger id="sched-slot-duration" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOT_DURATION_OPTIONS.map((mins) => (
                        <SelectItem key={mins} value={String(mins)}>
                          {formatDuration(mins)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    Length of one bookable slot on the PA booking calendar. Faculty can pick consecutive slots for
                    a longer booking.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-max-slots">Slots per booking</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sched-max-slots"
                      type="number"
                      min="0"
                      max="96"
                      value={form.maxSlotsPerBooking}
                      onChange={(e) =>
                        set("maxSlotsPerBooking", Math.min(96, Math.max(0, parseInt(e.target.value) || 0)))
                      }
                      className="w-32"
                    />
                    <span className="text-sm text-slate-500">slots max</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {form.maxSlotsPerBooking === 0
                      ? "Faculty can combine any number of consecutive slots into one booking. Set a number to cap it."
                      : `One booking can cover at most ${form.maxSlotsPerBooking} slot${
                          form.maxSlotsPerBooking === 1 ? "" : "s"
                        } (${formatDuration(form.maxSlotsPerBooking * form.slotDurationMinutes)}).`}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-booking-limit">Faculty PA booking limit</Label>
                  <Input
                    id="sched-booking-limit"
                    type="number"
                    min="0"
                    value={form.facultyBookingLimit}
                    onChange={(e) => set("facultyBookingLimit", Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-32"
                  />
                  <p className="text-xs text-slate-400">
                    Max PA bookings a faculty member can have active at once. 0 = unlimited.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-booking-horizon">Booking window</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sched-booking-horizon"
                      type="number"
                      min="1"
                      max="90"
                      value={form.bookingHorizonDays}
                      onChange={(e) =>
                        set("bookingHorizonDays", Math.min(90, Math.max(1, parseInt(e.target.value) || 1)))
                      }
                      className="w-32"
                    />
                    <span className="text-sm text-slate-500">days ahead</span>
                  </div>
                  <p className="text-xs text-slate-400">How far in advance faculty can book a PA — today counts as day 1.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sched-change-cutoff">Cancellation / reschedule cutoff</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sched-change-cutoff"
                      type="number"
                      min="0"
                      max="2880"
                      value={form.bookingChangeCutoffMinutes}
                      onChange={(e) =>
                        set(
                          "bookingChangeCutoffMinutes",
                          Math.min(2880, Math.max(0, parseInt(e.target.value) || 0))
                        )
                      }
                      className="w-32"
                    />
                    <span className="text-sm text-slate-500">minutes before start</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {form.bookingChangeCutoffMinutes === 0
                      ? "A booking can be cancelled or rescheduled right up until it starts."
                      : `A booking can only be cancelled or rescheduled until ${formatDuration(
                          form.bookingChangeCutoffMinutes
                        )} before its start time.`}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <WorkTypesEditor />
                </div>
              </div>
            )}
          </div>

          {error && form && (
            <p className="mx-4 mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600 sm:mx-5">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <Button type="button" variant="outline" className="w-full cursor-pointer sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="w-full cursor-pointer sm:w-auto" disabled={submitting || loading || !form}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {submitting ? "Saving..." : "Save for all departments"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
