"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { downloadTextFile, toCsv } from "@/lib/csv"
import { PA_CSV_COLUMNS, PA_CSV_SAMPLE, parsePaCsv, type PaCsvRow } from "@/lib/csv-pas"
import { cn } from "@/lib/utils"

/**
 * Bulk-invite Project Assistants from a CSV. Shows the expected columns up
 * front, previews every row with its validation state, then reports what
 * happened to each row after the import.
 */

type Department = { id: string; name: string }

type RowResult = {
  email: string
  status: "created" | "skipped" | "failed"
  reason?: string
  departmentName?: string
}

export function ImportPasDialog({
  open,
  onOpenChange,
  departments,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: Department[]
  onImported: () => void
}) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<PaCsvRow[]>([])
  const [missingEmailColumn, setMissingEmailColumn] = useState(false)
  const [defaultDepartmentId, setDefaultDepartmentId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)

  const departmentNames = useMemo(() => new Set(departments.map((d) => d.name.trim().toLowerCase())), [departments])

  // Rows the server would accept: valid email, and a department it can resolve
  const importable = useMemo(
    () =>
      rows.filter((r) => {
        if (r.error) return false
        if (r.department) return departmentNames.has(r.department.toLowerCase())
        return Boolean(defaultDepartmentId)
      }),
    [rows, departmentNames, defaultDepartmentId]
  )

  function rowIssue(r: PaCsvRow): string | null {
    if (r.error) return r.error
    if (r.department && !departmentNames.has(r.department.toLowerCase())) return `Unknown department "${r.department}"`
    if (!r.department && !defaultDepartmentId) return "No department — pick a default below"
    return null
  }

  function reset() {
    setFileName(null)
    setRows([])
    setMissingEmailColumn(false)
    setResults(null)
    setSubmitting(false)
  }

  function close() {
    onOpenChange(false)
    reset()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResults(null)
    const parsed = parsePaCsv(await file.text())
    setRows(parsed.rows)
    setMissingEmailColumn(parsed.missingEmailColumn)
  }

  async function submit() {
    if (importable.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: importable.map((r) => ({
            email: r.email,
            name: r.name,
            phoneNumber: r.phoneNumber,
            empCode: r.empCode,
            department: r.department,
          })),
          defaultDepartmentId: defaultDepartmentId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Import failed")
      setResults(data.results as RowResult[])
      toast.success(`${data.created} Project Assistant${data.created === 1 ? "" : "s"} invited`)
      onImported()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setSubmitting(false)
    }
  }

  const created = results?.filter((r) => r.status === "created").length ?? 0

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto bg-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" /> Import Project Assistants from CSV
          </DialogTitle>
          <DialogDescription>
            Each row becomes an invited PA account and receives the usual invite email. Rows with an existing
            email or employee code are skipped.
          </DialogDescription>
        </DialogHeader>

        {/* Column guide */}
        <div className="rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Expected columns</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs text-indigo-600 hover:bg-indigo-50"
              onClick={() => downloadTextFile("project-assistants-template.csv", toCsv(PA_CSV_SAMPLE))}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Download template
            </Button>
          </div>
          <div className="grid gap-x-6 gap-y-1.5 px-4 py-3 sm:grid-cols-2">
            {PA_CSV_COLUMNS.map((c) => (
              <div key={c.name} className="flex items-baseline gap-2 text-xs">
                <code className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">{c.name}</code>
                {c.required ? (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-rose-500">required</span>
                ) : (
                  <span className="shrink-0 text-[10px] font-semibold uppercase text-slate-400">optional</span>
                )}
                <span className="text-slate-500">{c.hint}</span>
              </div>
            ))}
          </div>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            First row must be the header. Column order doesn&apos;t matter and names aren&apos;t case-sensitive.
          </p>
        </div>

        {!results && (
          <>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600">
              <Upload className="h-4 w-4" />
              {fileName ? `Selected: ${fileName}` : "Choose a CSV file"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>

            {missingEmailColumn && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
                Couldn&apos;t find an <code>Email</code> column in the header row. Check the file against the
                columns above.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="import-default-dept" className="text-xs">
                Default department <span className="font-normal text-slate-400">— for rows with a blank Department column</span>
              </Label>
              <select
                id="import-default-dept"
                value={defaultDepartmentId}
                onChange={(e) => setDefaultDepartmentId(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">No default — every row must name its department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {rows.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{importable.length}</span> of {rows.length} row
                  {rows.length === 1 ? "" : "s"} ready to import
                </p>
                <div className="max-h-64 overflow-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Emp code</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((r) => {
                        const issue = rowIssue(r)
                        return (
                          <tr key={r.line} className={cn(issue && "bg-red-50/40")}>
                            <td className="px-3 py-1.5 text-slate-400">{r.line}</td>
                            <td className="px-3 py-1.5 font-medium text-slate-800">{r.email || "—"}</td>
                            <td className="px-3 py-1.5">{r.name || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-1.5">{r.empCode || <span className="text-slate-400">—</span>}</td>
                            <td className="px-3 py-1.5">
                              {r.department || (
                                <span className="italic text-slate-400">
                                  {departments.find((d) => d.id === defaultDepartmentId)?.name ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-1.5">
                              {issue ? (
                                <span className="text-red-600">{issue}</span>
                              ) : (
                                <span className="text-emerald-600">Ready</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {results && (
          <div>
            <div className="mb-2 flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {created} invited
              </span>
              {results.length - created > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                  <XCircle className="h-4 w-4" /> {results.length - created} skipped
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {results.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium text-slate-800">{r.email}</td>
                      <td className="px-3 py-1.5 text-slate-600">{r.departmentName ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        {r.status === "created" ? (
                          <span className="text-emerald-600">Invite sent</span>
                        ) : (
                          <span className={r.status === "failed" ? "text-red-600" : "text-amber-700"}>{r.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {results ? (
            <Button type="button" className="cursor-pointer" onClick={close}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="cursor-pointer" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                className="cursor-pointer"
                onClick={submit}
                disabled={submitting || importable.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Inviting…
                  </>
                ) : (
                  `Invite ${importable.length || ""} PA${importable.length === 1 ? "" : "s"}`
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
