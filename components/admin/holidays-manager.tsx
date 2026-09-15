"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { CalendarDays, Download, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HolidayCalendar } from "@/components/shared/holiday-calendar"
import { PREDEFINED_RELIGIOUS_HOLIDAYS } from "@/lib/holidays"
import { parseHolidayCsv, type HolidayCsvRow } from "@/lib/csv-holidays"
import { downloadTextFile, toCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"

/**
 * The organization-wide holiday calendar. One list for every department:
 * pick from the common religious holidays, add custom/national ones, or
 * import a CSV. Each change saves immediately.
 */

type HolidayType = "NATIONAL" | "RELIGIOUS" | "CUSTOM"
type Holiday = { id: string; name: string; date: string; type: HolidayType }

const TYPE_STYLES: Record<HolidayType, string> = {
  NATIONAL: "bg-indigo-50 text-indigo-700",
  RELIGIOUS: "bg-amber-50 text-amber-700",
  CUSTOM: "bg-slate-100 text-slate-600",
}

const TYPE_ITEMS: Record<HolidayType, string> = { NATIONAL: "National", RELIGIOUS: "Religious", CUSTOM: "Custom" }

/** What the CSV importer expects, shown in the dialog and offered as a template. */
const HOLIDAY_CSV_COLUMNS = [
  { name: "Date", hint: "YYYY-MM-DD, e.g. 2026-10-20" },
  { name: "Holiday Name", hint: "e.g. Diwali" },
  { name: "Holiday Type", hint: "National, Religious or Custom" },
]
const HOLIDAY_CSV_SAMPLE: string[][] = [
  HOLIDAY_CSV_COLUMNS.map((c) => c.name),
  ["2026-10-20", "Diwali", "Religious"],
  ["2026-01-26", "Republic Day", "National"],
  ["2026-03-14", "Founder's Day", "Custom"],
]

/** "yyyy-MM-dd" for a @db.Date value, without the timezone shifting the day. */
const dateKey = (iso: string) => iso.slice(0, 10)

export function HolidaysManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<"closed" | "picker" | "custom" | "edit" | "import">("closed")
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [form, setForm] = useState<{ name: string; date: string; type: HolidayType }>({ name: "", date: "", type: "CUSTOM" })
  const [draftReligious, setDraftReligious] = useState<{ name: string; date: string }[]>([])
  const [csvRows, setCsvRows] = useState<HolidayCsvRow[]>([])
  const [csvName, setCsvName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings/holidays")
      const data = await res.json()
      if (res.ok) setHolidays(data.holidays ?? [])
      else toast.error(data?.error || "Failed to load holidays")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const todayKey = format(new Date(), "yyyy-MM-dd")
  const visible = useMemo(
    () => (showPast ? holidays : holidays.filter((h) => dateKey(h.date) >= todayKey)),
    [holidays, showPast, todayKey]
  )
  const pastCount = holidays.length - holidays.filter((h) => dateKey(h.date) >= todayKey).length

  function openAdd() {
    setDraftReligious([])
    setForm({ name: "", date: "", type: "CUSTOM" })
    setDialog("picker")
  }
  function openEdit(h: Holiday) {
    setEditing(h)
    setForm({ name: h.name, date: dateKey(h.date), type: h.type })
    setDialog("edit")
  }
  function close() {
    setDialog("closed")
    setEditing(null)
    setCsvRows([])
    setCsvName(null)
  }

  async function request(url: string, init: RequestInit, okMessage: string) {
    setSubmitting(true)
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Request failed")
      toast.success(okMessage)
      await load()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed")
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function saveCustom() {
    if (!form.name.trim() || !form.date) return
    if (await request("/api/settings/holidays", { method: "POST", body: JSON.stringify(form) }, "Holiday added")) close()
  }
  async function saveReligious() {
    if (draftReligious.some((d) => !d.date)) return
    const ok = await request(
      "/api/settings/holidays",
      { method: "POST", body: JSON.stringify({ holidays: draftReligious.map((d) => ({ ...d, type: "RELIGIOUS" })) }) },
      `Added ${draftReligious.length} holiday${draftReligious.length === 1 ? "" : "s"}`
    )
    if (ok) close()
  }
  async function saveEdit() {
    if (!editing) return
    if (await request(`/api/settings/holidays/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) }, "Holiday updated")) close()
  }
  async function remove(h: Holiday) {
    if (!window.confirm(`Remove "${h.name}" on ${format(new Date(`${dateKey(h.date)}T00:00:00`), "MMM d, yyyy")}?`)) return
    if (await request(`/api/settings/holidays/${h.id}`, { method: "DELETE" }, "Holiday removed")) close()
  }
  async function importCsv() {
    const rows = csvRows.filter((r) => !r.error).map(({ name, date, type }) => ({ name, date, type }))
    if (rows.length === 0) return
    if (await request("/api/settings/holidays", { method: "POST", body: JSON.stringify({ holidays: rows }) }, "Holidays imported")) close()
  }

  return (
    <div className="px-5 py-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <HolidayCalendar holidays={holidays} size="compact" />
          </div>
          <div className="space-y-2">
            <Button type="button" className="w-full cursor-pointer" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" /> Add holiday
            </Button>
            <Button type="button" variant="outline" className="w-full cursor-pointer" onClick={() => setDialog("import")}>
              <Upload className="mr-1.5 h-4 w-4" /> Import CSV
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            Holidays apply to every department: no bookings can be made on them and they don&apos;t count as
            absent days in attendance.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {visible.length} {showPast ? "holidays" : "upcoming"}
            </p>
            {pastCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="cursor-pointer text-xs font-medium text-indigo-600 hover:underline"
              >
                {showPast ? "Hide past" : `Show ${pastCount} past`}
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            ) : visible.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarDays className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                <p className="text-sm text-slate-400">No {showPast ? "" : "upcoming "}holidays.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((h) => {
                  const key = dateKey(h.date)
                  const past = key < todayKey
                  return (
                    <li key={h.id} className={cn("flex items-center gap-3 px-4 py-2.5", past && "opacity-60")}>
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-lg font-bold leading-none text-slate-900">{format(new Date(`${key}T00:00:00`), "d")}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">{format(new Date(`${key}T00:00:00`), "MMM yy")}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{h.name}</p>
                        <p className="text-xs text-slate-400">{format(new Date(`${key}T00:00:00`), "EEEE")}</p>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", TYPE_STYLES[h.type])}>
                        {h.type}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={`Edit ${h.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(h)}
                        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${h.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={dialog !== "closed" && dialog !== "import"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialog === "edit" ? "Edit holiday" : "Add holiday"}</DialogTitle>
            <DialogDescription>
              {dialog === "edit"
                ? "Update details for this holiday."
                : "Pick common religious holidays and set their dates, or add a custom / national one."}
            </DialogDescription>
          </DialogHeader>

          {dialog === "edit" || dialog === "custom" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void (dialog === "edit" ? saveEdit() : saveCustom())
              }}
              className="space-y-4 pt-2"
            >
              <div className="space-y-2">
                <Label htmlFor="holiday-name">Name</Label>
                <Input
                  id="holiday-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Founder's Day"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holiday-date">Date</Label>
                  <Input
                    id="holiday-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    items={TYPE_ITEMS}
                    value={form.type}
                    onValueChange={(v) => v && setForm({ ...form, type: v as HolidayType })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATIONAL">National</SelectItem>
                      <SelectItem value="RELIGIOUS">Religious</SelectItem>
                      <SelectItem value="CUSTOM">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2 sm:justify-between">
                {dialog === "edit" && editing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="cursor-pointer px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => remove(editing)}
                    disabled={submitting}
                  >
                    Delete
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" className="cursor-pointer text-slate-500" onClick={() => setDialog("picker")}>
                    ← Back to picker
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="cursor-pointer" onClick={close}>
                    Cancel
                  </Button>
                  <Button type="submit" className="cursor-pointer" disabled={submitting || !form.name.trim() || !form.date}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {dialog === "edit" ? "Save" : "Add holiday"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-5 pt-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {PREDEFINED_RELIGIOUS_HOLIDAYS.map((name) => {
                  const selected = draftReligious.some((d) => d.name === name)
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() =>
                        setDraftReligious(
                          selected ? draftReligious.filter((d) => d.name !== name) : [...draftReligious, { name, date: "" }]
                        )
                      }
                      className={cn(
                        "cursor-pointer rounded-lg border p-2 text-center text-[11px] font-medium transition-all",
                        selected
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {name}
                    </button>
                  )
                })}
              </div>

              {draftReligious.length > 0 && (
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Set dates for selected holidays</p>
                  <div className="space-y-2">
                    {draftReligious.map((draft, idx) => (
                      <div key={draft.name} className="flex items-center gap-3">
                        <span className="w-32 shrink-0 text-xs font-semibold text-slate-700">{draft.name}</span>
                        <Input
                          type="date"
                          className="h-8 w-full bg-white text-xs"
                          value={draft.date}
                          onChange={(e) => {
                            const next = [...draftReligious]
                            next[idx] = { ...next[idx], date: e.target.value }
                            setDraftReligious(next)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      size="sm"
                      className="cursor-pointer"
                      disabled={submitting || draftReligious.some((d) => !d.date)}
                      onClick={saveReligious}
                    >
                      {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Add selected
                    </Button>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer border-dashed"
                  onClick={() => {
                    setForm({ name: "", date: "", type: "CUSTOM" })
                    setDialog("custom")
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add custom / national holiday
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV import dialog */}
      <Dialog open={dialog === "import"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import holidays from CSV</DialogTitle>
            <DialogDescription>
              Holidays that already exist (same name and date) are skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expected columns, in this order</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer text-xs text-indigo-600 hover:bg-indigo-50"
                onClick={() => downloadTextFile("holidays-template.csv", toCsv(HOLIDAY_CSV_SAMPLE))}
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Download template
              </Button>
            </div>
            <div className="space-y-1.5 px-4 py-3">
              {HOLIDAY_CSV_COLUMNS.map((c, i) => (
                <div key={c.name} className="flex items-baseline gap-2 text-xs">
                  <span className="w-4 shrink-0 text-[10px] font-semibold text-slate-400">{i + 1}.</span>
                  <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">{c.name}</code>
                  <span className="text-slate-500">{c.hint}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Example</p>
              <pre className="overflow-x-auto rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
{toCsv(HOLIDAY_CSV_SAMPLE).trimEnd()}
              </pre>
              <p className="mt-1.5 text-[11px] text-slate-400">The first row is the header and is skipped.</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600">
            <Upload className="h-4 w-4" />
            {csvName ? `Selected: ${csvName}` : "Choose a CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setCsvName(file.name)
                setCsvRows(parseHolidayCsv(await file.text()))
              }}
            />
          </label>

          {csvRows.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {csvRows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{r.date}</td>
                      <td className="px-3 py-1.5">{r.name || "—"}</td>
                      <td className="px-3 py-1.5 capitalize">{r.type.toLowerCase()}</td>
                      <td className="px-3 py-1.5">
                        {r.error ? <span className="text-red-500">{r.error}</span> : <span className="text-emerald-600">Valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="cursor-pointer" onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={importCsv}
              disabled={submitting || csvRows.filter((r) => !r.error).length === 0}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {csvRows.filter((r) => !r.error).length || ""} valid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
