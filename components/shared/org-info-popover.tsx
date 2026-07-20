"use client"

import { useState } from "react"
import { PreviewCard } from "@base-ui/react/preview-card"
import { Info, Building2, Clock, MapPin, CalendarDays, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface OrgLocation {
  name: string
  latitude: number
  longitude: number
}

interface OrgInfo {
  name: string
  shiftStartTime: string
  shiftEndTime: string
  workingDays: string
  locations: OrgLocation[]
}

export function OrgInfoPopover() {
  const [info, setInfo] = useState<OrgInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [fetched, setFetched] = useState(false)

  const loadInfo = async () => {
    if (fetched) return
    setFetched(true)
    setLoading(true)
    try {
      const res = await fetch("/api/departments/me")
      const data = await res.json()
      if (res.ok) setInfo(data.department)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PreviewCard.Root onOpenChange={(open) => open && loadInfo()}>
      <PreviewCard.Trigger
        delay={0}
        closeDelay={0}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
        aria-label="Department info"
      >
        <Info className="h-4.5 w-4.5" />
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <PreviewCard.Popup
            className={cn(
              "w-72 origin-(--transform-origin) rounded-xl border border-slate-100 bg-white p-4 shadow-lg",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : error || !info ? (
              <p className="text-xs text-slate-400">Department info unavailable.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-900">{info.name}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium text-slate-600">
                      Shift: {info.shiftStartTime} – {info.shiftEndTime}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <p className="text-xs font-medium text-slate-600">
                    Working days: {info.workingDays.split(",").join(", ")}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <div className="space-y-1">
                    {info.locations.length === 0 ? (
                      <p className="text-xs text-slate-400">No locations configured</p>
                    ) : (
                      info.locations.map((loc, idx) => (
                        <p key={idx} className="text-xs font-medium text-slate-600">
                          {loc.name}{" "}
                          <span className="text-slate-400">
                            ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)})
                          </span>
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
