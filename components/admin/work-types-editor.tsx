"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type WorkType = { id: string; name: string }

/**
 * Add / rename / remove the work types faculty pick from when booking a PA.
 * Each action saves immediately (it's its own API call), independent of the
 * surrounding schedule form's Save button.
 */
export function WorkTypesEditor() {
  const [items, setItems] = useState<WorkType[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/work-types")
      const data = await res.json()
      if (res.ok) setItems(data.workTypes ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    const name = draft.trim()
    if (!name) return
    setAdding(true)
    try {
      const res = await fetch("/api/work-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to add")
      setDraft("")
      setItems((prev) => [...prev, data.workType])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setAdding(false)
    }
  }

  async function rename(id: string) {
    const name = editName.trim()
    const current = items.find((t) => t.id === id)
    if (!name || !current || name === current.name) {
      setEditingId(null)
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/work-types/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to rename")
      setItems((prev) => prev.map((t) => (t.id === id ? data.workType : t)))
      setEditingId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to rename")
    } finally {
      setBusyId(null)
    }
  }

  async function remove(t: WorkType) {
    if (!window.confirm(`Remove "${t.name}" from the work types? Existing bookings keep it.`)) return
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/work-types/${t.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to remove")
      setItems((prev) => prev.filter((x) => x.id !== t.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-2">
      <Label>Work types</Label>
      <p className="text-xs text-slate-400">
        What faculty choose from when booking a PA. Changes apply immediately; bookings already made keep
        their original type.
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">No work types yet — add one below.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2">
                <Tag className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                {editingId === t.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void rename(t.id)
                        }
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      maxLength={60}
                      className="h-8 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => rename(t.id)}
                      disabled={busyId === t.id}
                      className="cursor-pointer rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                      aria-label="Save name"
                    >
                      {busyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                      aria-label="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm text-slate-800">{t.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(t.id)
                        setEditName(t.name)
                      }}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Rename ${t.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      disabled={busyId === t.id || items.length <= 1}
                      title={items.length <= 1 ? "Keep at least one work type" : undefined}
                      className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Remove ${t.name}`}
                    >
                      {busyId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void add()
            }
          }}
          placeholder="New work type, e.g. Equipment Setup"
          maxLength={60}
          className="h-9 flex-1 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          className="h-9 cursor-pointer"
          onClick={add}
          disabled={adding || !draft.trim()}
        >
          {adding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
          Add
        </Button>
      </div>
    </div>
  )
}
