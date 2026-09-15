"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * Organization-wide geo-fence: the on/off switch (stored on ScheduleSettings)
 * and the list of places staff may punch attendance from. Every department's
 * members can check in at any of the pins.
 */

export type DraftLocation = {
  name: string
  latitude: string
  longitude: string
  radiusMeters: number
}

export function LocationsEditor({
  locations,
  onChange,
  geofenceEnabled,
  onGeofenceEnabledChange,
}: {
  locations: DraftLocation[]
  onChange: (locations: DraftLocation[]) => void
  geofenceEnabled: boolean
  onGeofenceEnabledChange: (enabled: boolean) => void
}) {
  const addLocation = () => {
    onChange([...locations, { name: "", latitude: "", longitude: "", radiusMeters: 100 }])
  }
  const updateLocation = (idx: number, patch: Partial<DraftLocation>) => {
    onChange(locations.map((loc, i) => (i === idx ? { ...loc, ...patch } : loc)))
  }
  const removeLocation = (idx: number) => {
    onChange(locations.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <Label className="text-sm">Enforce geo-fencing</Label>
          <p className="mt-0.5 text-xs text-slate-500">
            When on, staff must share their location and be inside one of the pinned locations to punch
            attendance. When off, they can punch from anywhere without a location prompt.
          </p>
        </div>
        <Switch
          checked={geofenceEnabled}
          onCheckedChange={(checked: boolean) => onGeofenceEnabledChange(checked)}
          className="mt-0.5 shrink-0 data-checked:bg-indigo-600"
        />
      </div>

      {geofenceEnabled && locations.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-700">
            Geo-fencing is on but no locations are pinned yet — staff will still be asked for their location,
            but it won&apos;t be restricted until you add at least one below.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <p className="text-xs leading-relaxed text-indigo-700">
          Add one or more campus locations. Staff from every department can check in and out from any of them.
        </p>
      </div>

      {locations.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-400">
          No locations added — check-in/out will be unrestricted.
        </p>
      )}

      <div className="space-y-3">
        {locations.map((loc, idx) => (
          <div key={idx} className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Location name, e.g. Main Building"
                value={loc.name}
                onChange={(e) => updateLocation(idx, { name: e.target.value })}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => removeLocation(idx)}
                className="shrink-0 cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                aria-label="Remove location"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                step="any"
                placeholder="Latitude"
                value={loc.latitude}
                onChange={(e) => updateLocation(idx, { latitude: e.target.value })}
              />
              <Input
                type="number"
                step="any"
                placeholder="Longitude"
                value={loc.longitude}
                onChange={(e) => updateLocation(idx, { longitude: e.target.value })}
              />
              <Input
                type="number"
                min="10"
                placeholder="Radius (m)"
                value={loc.radiusMeters}
                onChange={(e) => updateLocation(idx, { radiusMeters: parseInt(e.target.value) || 100 })}
              />
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" className="w-full cursor-pointer border-dashed" onClick={addLocation}>
        <Plus className="mr-1.5 h-4 w-4" /> Add location
      </Button>
    </div>
  )
}

export function AttendanceLocationsForm() {
  const [locations, setLocations] = useState<DraftLocation[]>([])
  const [geofenceEnabled, setGeofenceEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [locRes, setRes] = await Promise.all([fetch("/api/settings/locations"), fetch("/api/settings/schedule")])
      const locData = await locRes.json()
      const setData = await setRes.json()
      if (!locRes.ok) throw new Error(locData?.error || "Failed to load locations")
      if (!setRes.ok) throw new Error(setData?.error || "Failed to load settings")
      setLocations(
        (locData.locations ?? []).map((l: { name: string; latitude: number; longitude: number; radiusMeters: number }) => ({
          name: l.name,
          latitude: String(l.latitude),
          longitude: String(l.longitude),
          radiusMeters: l.radiusMeters,
        }))
      )
      setGeofenceEnabled(Boolean(setData.settings?.geofenceEnabled))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const [locRes, setRes] = await Promise.all([
        fetch("/api/settings/locations", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locations: locations.map((l) => ({
              name: l.name,
              latitude: Number(l.latitude),
              longitude: Number(l.longitude),
              radiusMeters: Number(l.radiusMeters),
            })),
          }),
        }),
        fetch("/api/settings/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geofenceEnabled }),
        }),
      ])
      const locData = await locRes.json()
      const setData = await setRes.json()
      if (!locRes.ok) throw new Error(locData?.error || "Failed to save locations")
      if (!setRes.ok) throw new Error(setData?.error || "Failed to save geo-fence setting")
      toast.success("Geo-fence settings saved for all departments")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div className="px-5 py-5">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            )}
          </div>
        ) : (
          <LocationsEditor
            locations={locations}
            onChange={setLocations}
            geofenceEnabled={geofenceEnabled}
            onGeofenceEnabledChange={setGeofenceEnabled}
          />
        )}
      </div>

      {error && !loading && (
        <p className="mx-5 mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        <Button type="submit" className="cursor-pointer" disabled={submitting || loading}>
          {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Save geo-fence settings"}
        </Button>
      </div>
    </form>
  )
}
