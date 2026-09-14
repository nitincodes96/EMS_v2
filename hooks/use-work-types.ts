"use client"

import { useEffect, useState } from "react"

/**
 * The admin-managed work types for the booking forms. Returns names only —
 * that's all a select needs — plus a loading flag so the dropdown can show a
 * placeholder rather than an empty list on first paint.
 */
export function useWorkTypes(): { workTypes: string[]; loading: boolean } {
  const [workTypes, setWorkTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch("/api/work-types")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return
        setWorkTypes(((d?.workTypes ?? []) as { name: string }[]).map((t) => t.name))
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return { workTypes, loading }
}
