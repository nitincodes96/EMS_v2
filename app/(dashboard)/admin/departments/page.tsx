"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    Plus,
    Users,
    Building2,
    Edit,
    Loader2,
    CalendarDays,
    Search,
    CheckCircle2,
    MapPin,
    Clock,
    ImagePlus,
    Trash2,
    Upload,
    X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { parseHolidayCsv, type HolidayCsvRow } from "@/lib/csv-holidays"
import { ScheduleSettingsDialog } from "@/components/admin/schedule-settings-dialog"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgLocation {
    id: string
    name: string
    latitude: number
    longitude: number
    radiusMeters: number
}

interface Department {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    geofenceEnabled: boolean
    locations: OrgLocation[]
    createdAt: string
    adminCount: number
    userCount: number
    _count: {
        users: number
        leaves: number
        attendances: number
    }
}

// Working hours and booking rules are organization-wide (see the Schedule
// settings dialog), so the wizard only covers what's specific to a department.
const STEPS = ["Basic Info", "Geo-fence", "Holiday Calendar", "Review"]

interface DraftLocation {
    name: string
    latitude: string
    longitude: string
    radiusMeters: number
}

const defaultFormData = {
    name: "",
    description: "",
    geofenceEnabled: true,
    locations: [] as DraftLocation[],
    holidays: [] as HolidayCsvRow[],
}

const AVATAR_COLORS = [
    "bg-indigo-50 text-indigo-600 border-indigo-100",
    "bg-violet-50 text-violet-600 border-violet-100",
    "bg-emerald-50 text-emerald-600 border-emerald-100",
    "bg-amber-50 text-amber-600 border-amber-100",
    "bg-rose-50 text-rose-600 border-rose-100",
    "bg-cyan-50 text-cyan-600 border-cyan-100",
]

const avatarColor = (name: string) =>
    AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function OrgAvatar({
    name,
    logoUrl,
    className,
}: {
    name: string
    logoUrl?: string | null
    className?: string
}) {
    if (logoUrl) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
            <img
                src={logoUrl}
                alt={name}
                className={cn("object-cover rounded-xl", className)}
            />
        )
    }
    return (
        <div
            className={cn(
                "flex items-center justify-center rounded-xl border text-sm font-bold",
                avatarColor(name || "Department"),
                className
            )}
        >
            {(name || "O").slice(0, 2).toUpperCase()}
        </div>
    )
}

function StepIndicator({ current }: { current: number }) {
    return (
        <div className="flex items-center gap-0 border-b border-slate-100 bg-slate-50/60 px-3 py-4 sm:px-6">
            {STEPS.map((label, idx) => {
                const stepNum = idx + 1
                const done = stepNum < current
                const active = stepNum === current
                return (
                    <div key={label} className="flex min-w-0 flex-1 items-center justify-center">
                        <div className="flex shrink-0 flex-col items-center gap-1">
                            <div
                                className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                                    done || active
                                        ? "border-indigo-600 bg-indigo-600 text-white"
                                        : "border-slate-200 bg-white text-slate-400"
                                )}
                            >
                                {done ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
                            </div>
                            <span
                                className={cn(
                                    "hidden text-[10px] font-medium leading-none whitespace-nowrap sm:block",
                                    active ? "text-indigo-600" : done ? "text-slate-900" : "text-slate-400"
                                )}
                            >
                                {label}
                            </span>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div
                                className={cn(
                                    "mx-2 mb-4 h-px flex-1 transition-colors",
                                    done ? "bg-indigo-600" : "bg-slate-200"
                                )}
                            />
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function ReviewRow({
    icon,
    label,
    value,
}: {
    icon?: React.ReactNode
    label: string
    value: string
}) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            {icon ? <span className="shrink-0 text-indigo-600">{icon}</span> : <span className="w-4 shrink-0" />}
            <span className="w-24 shrink-0 text-xs font-medium text-slate-500">{label}</span>
            <span className="truncate text-sm font-semibold text-slate-900">{value}</span>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Shared locations editor (used by both the wizard and the edit dialog)
// ---------------------------------------------------------------------------

function LocationsEditor({
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
                        When on, staff must share their location and be inside one of the pinned locations to
                        punch attendance. When off, they can punch from anywhere without a location prompt.
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
                        Geo-fencing is on but no locations are pinned yet — staff will still be asked for their
                        location, but it won&apos;t be restricted until you add at least one below.
                    </p>
                </div>
            )}

            <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <p className="text-xs leading-relaxed text-indigo-700">
                    Add one or more office locations. Employees can check in and out from any of them.
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
                                placeholder="Location name, e.g. HQ"
                                value={loc.name}
                                onChange={(e) => updateLocation(idx, { name: e.target.value })}
                                className="flex-1"
                            />
                            <button
                                type="button"
                                onClick={() => removeLocation(idx)}
                                className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
                                min="1"
                                placeholder="Radius (m)"
                                value={loc.radiusMeters}
                                onChange={(e) => updateLocation(idx, { radiusMeters: parseInt(e.target.value) || 100 })}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <Button type="button" variant="outline" className="w-full border-dashed" onClick={addLocation}>
                <Plus className="mr-1.5 h-4 w-4" /> Add location
            </Button>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Holiday calendar CSV import step (used by the wizard)
// ---------------------------------------------------------------------------

function HolidayCsvStep({
    holidays,
    onChange,
}: {
    holidays: HolidayCsvRow[]
    onChange: (holidays: HolidayCsvRow[]) => void
}) {
    const [fileName, setFileName] = useState<string | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFileName(file.name)
        const text = await file.text()
        onChange(parseHolidayCsv(text))
    }

    const removeRow = (idx: number) => {
        onChange(holidays.filter((_, i) => i !== idx))
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <p className="text-xs leading-relaxed text-indigo-700">
                    Optionally import a starting holiday calendar via CSV. First column Date, second Holiday Name,
                    third Holiday Type (Custom, Religious or National). This step is fully optional — skip it and
                    add holidays later from the department page.
                </p>
            </div>

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600">
                <Upload className="h-4 w-4" />
                {fileName ? `Selected: ${fileName}` : "Upload holiday calendar CSV"}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            </label>

            {holidays.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-100">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="hidden sm:table-cell">Status</TableHead>
                                <TableHead className="w-8" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {holidays.map((h, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="text-xs">{h.date}</TableCell>
                                    <TableCell className="text-xs">{h.name || "—"}</TableCell>
                                    <TableCell className="text-xs capitalize">{h.type.toLowerCase()}</TableCell>
                                    <TableCell className="hidden text-xs sm:table-cell">
                                        {h.error ? (
                                            <span className="text-red-500">{h.error}</span>
                                        ) : (
                                            <span className="text-emerald-600">Valid</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <button
                                            type="button"
                                            onClick={() => removeRow(idx)}
                                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// Create Department wizard
// ---------------------------------------------------------------------------

function CreateOrgWizard({
    onSuccess,
    onCancel,
}: {
    onSuccess: () => void
    onCancel: () => void
}) {
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState(defaultFormData)
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)

    const set = (key: keyof typeof defaultFormData, value: unknown) =>
        setFormData((prev) => ({ ...prev, [key]: value }))

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setError("Logo must be an image file.")
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setError("Logo must be under 2MB.")
            return
        }
        setLogoFile(file)
        const reader = new FileReader()
        reader.onload = () => setLogoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const validateStep = (): boolean => {
        setError("")
        if (step === 1 && !formData.name.trim()) {
            setError("Department name is required.")
            return false
        }
        return true
    }

    const next = () => {
        if (validateStep()) setStep((s) => s + 1)
    }
    const back = () => {
        setError("")
        setStep((s) => s - 1)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        setError("")
        try {
            const payload = new FormData()
            payload.append("name", formData.name)
            payload.append("description", formData.description)
            payload.append("geofenceEnabled", String(formData.geofenceEnabled))
            payload.append(
                "locations",
                JSON.stringify(
                    formData.locations.map((l) => ({
                        name: l.name,
                        latitude: Number(l.latitude),
                        longitude: Number(l.longitude),
                        radiusMeters: Number(l.radiusMeters),
                    }))
                )
            )
            payload.append(
                "holidays",
                JSON.stringify(
                    formData.holidays
                        .filter((h) => !h.error)
                        .map(({ name, date, type }) => ({ name, date, type }))
                )
            )
            if (logoFile) payload.append("logo", logoFile)

            const res = await fetch("/api/departments", { method: "POST", body: payload })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to create department")
                return
            }
            onSuccess()
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    const stepMeta = [
        { icon: <Building2 className="h-4 w-4" />, title: "Basic Info", hint: "Name and description" },
        { icon: <MapPin className="h-4 w-4" />, title: "Geo-fence", hint: "Check-in / check-out locations" },
        { icon: <CalendarDays className="h-4 w-4" />, title: "Holiday Calendar", hint: "Optional CSV import" },
        { icon: <CheckCircle2 className="h-4 w-4" />, title: "Review", hint: "Confirm and create" },
    ]

    return (
        <div className="flex flex-col">
            <StepIndicator current={step} />

            <div className="flex items-center gap-3 px-4 pt-5 pb-1 sm:px-6">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    {stepMeta[step - 1].icon}
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-900">{stepMeta[step - 1].title}</p>
                    <p className="text-xs text-slate-500">{stepMeta[step - 1].hint}</p>
                </div>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {step} / {STEPS.length}
                </span>
            </div>

            <div className="max-h-[calc(90vh-280px)] overflow-y-auto px-4 py-4 sm:px-6">
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="org-name">
                                Department name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="org-name"
                                placeholder="Acme Inc."
                                autoFocus
                                value={formData.name}
                                onChange={(e) => set("name", e.target.value)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="org-desc">Description</Label>
                            <Textarea
                                id="org-desc"
                                placeholder="Brief description of the department..."
                                rows={4}
                                className="resize-none text-sm"
                                value={formData.description}
                                onChange={(e) => set("description", e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Department logo</Label>
                            <div className="flex items-center gap-4">
                                <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500">
                                    {logoPreview ? (
                                        <OrgAvatar name={formData.name} logoUrl={logoPreview} className="h-full w-full" />
                                    ) : (
                                        <ImagePlus className="h-5 w-5" />
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                                </label>
                                <p className="text-xs text-slate-400">
                                    PNG, JPG or WEBP. Max 2MB. Optional — add this later.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <LocationsEditor
                        locations={formData.locations}
                        onChange={(locations) => set("locations", locations)}
                        geofenceEnabled={formData.geofenceEnabled}
                        onGeofenceEnabledChange={(enabled) => set("geofenceEnabled", enabled)}
                    />
                )}

                {step === 3 && (
                    <HolidayCsvStep
                        holidays={formData.holidays}
                        onChange={(holidays) => set("holidays", holidays)}
                    />
                )}

                {step === 4 && (
                    <div className="space-y-3">
                        <ReviewRow icon={<Building2 className="h-4 w-4" />} label="Name" value={formData.name} />
                        {logoFile && <ReviewRow label="Logo" value={logoFile.name} />}
                        {formData.description && <ReviewRow label="Description" value={formData.description} />}

                        <div className="space-y-2 pt-1">
                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Geo-fence
                            </p>
                            <ReviewRow
                                label="Enforcement"
                                value={formData.geofenceEnabled ? "On — location required" : "Off — no location needed"}
                            />
                            <ReviewRow
                                icon={<MapPin className="h-4 w-4" />}
                                label="Locations"
                                value={
                                    formData.locations.length > 0
                                        ? `${formData.locations.length} location${formData.locations.length > 1 ? "s" : ""} configured`
                                        : "Not configured"
                                }
                            />
                        </div>

                        <div className="space-y-2 pt-1">
                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Holiday calendar
                            </p>
                            <ReviewRow
                                icon={<CalendarDays className="h-4 w-4" />}
                                label="Holidays"
                                value={
                                    formData.holidays.filter((h) => !h.error).length > 0
                                        ? `${formData.holidays.filter((h) => !h.error).length} holiday(s) to be created`
                                        : "None"
                                }
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center sm:px-6">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={step === 1 ? onCancel : back}>
                    {step === 1 ? "Cancel" : "← Back"}
                </Button>

                <div className="flex items-center justify-center gap-1.5">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "h-1.5 rounded-full transition-all",
                                idx + 1 <= step ? "bg-indigo-600" : "bg-slate-200"
                            )}
                            style={{ width: idx + 1 === step ? 20 : 6 }}
                        />
                    ))}
                </div>

                {step < STEPS.length ? (
                    <Button type="button" className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 cursor-pointer" onClick={next}>
                        Continue
                    </Button>
                ) : (
                    <Button type="button" className="w-full sm:w-auto bg-indigo-500 hover:bg-indigo-600 cursor-pointer" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {submitting ? "Creating..." : "Create"}
                    </Button>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Edit Department dialog
// ---------------------------------------------------------------------------

function EditOrgDialog({
    org,
    onClose,
    onSuccess,
}: {
    org: Department
    onClose: () => void
    onSuccess: () => void
}) {
    const [form, setForm] = useState({
        name: org.name,
        description: org.description || "",
        geofenceEnabled: org.geofenceEnabled,
        locations: org.locations.map((l) => ({
            name: l.name,
            latitude: String(l.latitude),
            longitude: String(l.longitude),
            radiusMeters: l.radiusMeters,
        })) as DraftLocation[],
    })
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(org.logoUrl || null)
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }))

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            setError("Logo must be an image file.")
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setError("Logo must be under 2MB.")
            return
        }
        setLogoFile(file)
        const reader = new FileReader()
        reader.onload = () => setLogoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) {
            setError("Department name is required")
            return
        }
        setSubmitting(true)
        setError("")
        try {
            const payload = new FormData()
            payload.append("name", form.name)
            payload.append("description", form.description)
            payload.append("geofenceEnabled", String(form.geofenceEnabled))
            payload.append(
                "locations",
                JSON.stringify(
                    form.locations.map((l) => ({
                        name: l.name,
                        latitude: Number(l.latitude),
                        longitude: Number(l.longitude),
                        radiusMeters: Number(l.radiusMeters),
                    }))
                )
            )
            if (logoFile) payload.append("logo", logoFile)

            const res = await fetch(`/api/departments/${org.id}`, { method: "PATCH", body: payload })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to update department")
                return
            }
            onSuccess()
        } catch {
            setError("An error occurred. Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
            <Tabs defaultValue="basic" className="min-h-0 flex-1">
                <div className="px-5 pb-0 pt-3">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basic" className="gap-1.5 text-xs">
                            <Building2 className="h-3.5 w-3.5" /> Basic
                        </TabsTrigger>
                        <TabsTrigger value="geofence" className="gap-1.5 text-xs">
                            <MapPin className="h-3.5 w-3.5" /> Geo-fence
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="max-h-[calc(85vh-220px)] overflow-y-auto">

                <TabsContent value="basic" className="mt-0 min-h-56 space-y-4 px-4 py-4 sm:px-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">
                            Department name <span className="text-red-500">*</span>
                        </Label>
                        <Input id="edit-name" autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Textarea
                            id="edit-desc"
                            rows={4}
                            className="resize-none text-sm"
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Department logo</Label>
                        <div className="flex items-center gap-4">
                            <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500">
                                {logoPreview ? (
                                    <OrgAvatar name={form.name} logoUrl={logoPreview} className="h-full w-full" />
                                ) : (
                                    <ImagePlus className="h-5 w-5" />
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                            </label>
                            <p className="text-xs text-slate-400">Upload a new image to replace the current logo.</p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="geofence" className="mt-0 min-h-56 px-4 py-4 sm:px-5">
                    <LocationsEditor
                        locations={form.locations}
                        onChange={(locations) => set("locations", locations)}
                        geofenceEnabled={form.geofenceEnabled}
                        onGeofenceEnabledChange={(enabled) => set("geofenceEnabled", enabled)}
                    />
                </TabsContent>
                </div>
            </Tabs>

            {error && (
                <p className="mx-4 mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600 sm:mx-5">
                    {error}
                </p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" className="w-full sm:w-auto cursor-pointer" disabled={submitting}>
                    {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {submitting ? "Saving..." : "Save changes"}
                </Button>
            </div>
        </form>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DepartmentsPage() {
    const router = useRouter()
    const [departments, setDepartments] = useState<Department[]>([])
    const [loading, setLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState<Department | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [navigatingId, setNavigatingId] = useState<string | null>(null)
    const [scheduleOpen, setScheduleOpen] = useState(false)

    useEffect(() => {
        fetchDepartments()
    }, [])

    const fetchDepartments = async () => {
        try {
            const res = await fetch("/api/departments")
            const data = await res.json()
            if (res.ok) setDepartments(data.departments)
        } catch (err) {
            console.error("Error fetching departments:", err)
        } finally {
            setLoading(false)
        }
    }

    const filteredOrgs = departments.filter((org) =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleCreateSuccess = () => {
        setCreateDialogOpen(false)
        fetchDepartments()
    }

    const openEditDialog = (org: Department) => {
        setSelectedOrg(org)
        setEditDialogOpen(true)
    }

    const goToOrg = (org: Department) => {
        setNavigatingId(org.id)
        router.push(`/admin/departments/${org.slug}`)
    }

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
        )
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Departments</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage every department on the organization.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    className="h-9 px-4 font-semibold cursor-pointer"
                    onClick={() => setScheduleOpen(true)}
                >
                    <Clock className="mr-1.5 h-4 w-4 text-indigo-600" />
                    Schedule settings
                </Button>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger className="cursor-pointer">
                        <Button className="h-9 px-4 font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New Department
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] gap-0 overflow-hidden bg-white p-0 sm:min-w-xl max-h-[90vh]">
                        <DialogHeader className="border-b-0 px-6 pb-0 pt-5">
                            <DialogTitle className="text-base font-bold text-slate-900">New Department</DialogTitle>
                            <DialogDescription className="sr-only">Create department wizard</DialogDescription>
                        </DialogHeader>
                        <CreateOrgWizard onSuccess={handleCreateSuccess} onCancel={() => setCreateDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
                </div>
            </div>

            {/* One schedule for every department */}
            <ScheduleSettingsDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />

            {/* Search */}
            {departments.length > 0 && (
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search departments..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-9 text-sm"
                    />
                </div>
            )}

            {/* Empty state */}
            {departments.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-20">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                        <Building2 className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="mb-1 font-semibold text-slate-900">No departments yet</p>

                </div>
            ) : (
                /* Card grid */
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredOrgs.map((org) => (
                        <div
                            key={org.id}
                            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
                        >
                            {/* Card header */}
                            <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <OrgAvatar name={org.name} logoUrl={org.logoUrl} className="h-11 w-11 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">{org.name}</p>
                                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                                            {org.description || <span className="italic">No description</span>}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                    <span className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        Active
                                    </span>
                                    <button
                                        onClick={() => openEditDialog(org)}
                                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                    >
                                        <Edit className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* Stats row */}
                            <div className="mx-4 mb-3 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100">
                                <div className="flex flex-col items-center gap-0.5 bg-slate-50 px-3 py-2.5">
                                    <span className="text-base font-bold text-slate-900">{org._count.users}</span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Staff</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-slate-50 px-3 py-2.5">
                                    <span className="text-base font-bold text-slate-900">
                                        {org.adminCount}/{org.userCount}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Faculty/PAs</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-slate-50 px-3 py-2.5">
                                    <span className="text-base font-bold text-slate-900">
                                        {org.locations.length > 0 ? `${org.locations.length} loc${org.locations.length > 1 ? "s" : ""}` : "—"}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Locations</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex-1 px-4 pb-4 pt-1">
                                <p className="mb-2.5 flex items-center gap-1 text-[10px] text-slate-400">
                                    <CalendarDays className="h-3 w-3" />
                                    Created {format(new Date(org.createdAt), "MMM d, yyyy")}
                                </p>
                                <Button
                                    size="sm"
                                    className="h-8 w-full text-xs bg-indigo-500 hover:bg-indigo-600 cursor-pointer"
                                    onClick={() => goToOrg(org)}
                                    disabled={navigatingId === org.id}
                                >
                                    {navigatingId === org.id ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Users className="mr-1.5 h-3.5 w-3.5 opacity-75" />
                                    )}
                                    Manage
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit dialog */}
            <Dialog
                open={editDialogOpen}
                onOpenChange={(open) => {
                    if (!open) setSelectedOrg(null)
                    setEditDialogOpen(open)
                }}
            >
                <DialogContent className="w-[95vw] max-h-[90vh] gap-0 overflow-hidden bg-white p-0 sm:max-w-xl">
                    <DialogHeader className="px-5 pb-0 pt-5">
                        <DialogTitle className="text-base font-bold text-slate-900">Edit Department</DialogTitle>
                        <DialogDescription className="sr-only">Edit department settings</DialogDescription>
                    </DialogHeader>
                    {selectedOrg && (
                        <EditOrgDialog
                            org={selectedOrg}
                            onClose={() => {
                                setEditDialogOpen(false)
                                setSelectedOrg(null)
                            }}
                            onSuccess={() => {
                                setEditDialogOpen(false)
                                setSelectedOrg(null)
                                fetchDepartments()
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}