"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    Calendar,
    ImagePlus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Organization {
    id: string
    name: string
    description: string | null
    logoUrl: string | null
    workingDays: string
    shiftStartTime: string
    shiftEndTime: string
    lateGraceMinutes: number
    checkInRadiusMeters: number
    checkOutRadiusMeters: number
    latitude: number | null
    longitude: number | null
    employeeLeaveQuota: number
    internLeaveQuota: number
    contractualLeaveQuota: number
    employeeMonthlyCap: number
    internMonthlyCap: number
    contractualMonthlyCap: number
    createdAt: string
    adminCount: number
    userCount: number
    _count: {
        users: number
        leaves: number
        attendances: number
    }
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const GRACE_OPTIONS = [
    { label: "2 min", value: 2 },
    { label: "5 min", value: 5 },
    { label: "10 min", value: 10 },
    { label: "30 min", value: 30 },
]

const STEPS = ["Basic Info", "Work Schedule", "Geo-fence", "Leave Quotas", "Review"]

const defaultFormData = {
    name: "",
    description: "",
    workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"] as string[],
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateGraceMinutes: 5,
    checkInLatitude: "",
    checkInLongitude: "",
    checkInRadiusMeters: 100,
    checkOutLatitude: "",
    checkOutLongitude: "",
    checkOutRadiusMeters: 100,
    employeeLeaveQuota: 20,
    internLeaveQuota: 20,
    contractualLeaveQuota: 20,
    employeeMonthlyCap: 5,
    internMonthlyCap: 3,
    contractualMonthlyCap: 4,
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
                avatarColor(name || "Organization"),
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
// Create Organization wizard
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

    const toggleDay = (day: string) => {
        setFormData((prev) => ({
            ...prev,
            workingDays: prev.workingDays.includes(day)
                ? prev.workingDays.filter((d) => d !== day)
                : [...prev.workingDays, day],
        }))
    }

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
            setError("Organization name is required.")
            return false
        }
        if (step === 2 && formData.workingDays.length === 0) {
            setError("Select at least one working day.")
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
            payload.append("workingDays", formData.workingDays.join(","))
            payload.append("shiftStartTime", formData.shiftStartTime)
            payload.append("shiftEndTime", formData.shiftEndTime)
            payload.append("lateGraceMinutes", String(formData.lateGraceMinutes))
            payload.append("checkInLatitude", formData.checkInLatitude)
            payload.append("checkInLongitude", formData.checkInLongitude)
            payload.append("checkInRadiusMeters", String(formData.checkInRadiusMeters))
            payload.append("checkOutLatitude", formData.checkOutLatitude)
            payload.append("checkOutLongitude", formData.checkOutLongitude)
            payload.append("checkOutRadiusMeters", String(formData.checkOutRadiusMeters))
            payload.append("employeeLeaveQuota", String(formData.employeeLeaveQuota))
            payload.append("internLeaveQuota", String(formData.internLeaveQuota))
            payload.append("contractualLeaveQuota", String(formData.contractualLeaveQuota))
            payload.append("employeeMonthlyCap", String(formData.employeeMonthlyCap))
            payload.append("internMonthlyCap", String(formData.internMonthlyCap))
            payload.append("contractualMonthlyCap", String(formData.contractualMonthlyCap))
            if (logoFile) payload.append("logo", logoFile)

            const res = await fetch("/api/organizations", { method: "POST", body: payload })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to create organization")
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
        { icon: <Clock className="h-4 w-4" />, title: "Work Schedule", hint: "Shift times and working days" },
        { icon: <MapPin className="h-4 w-4" />, title: "Geo-fence", hint: "Check-in / check-out location" },
        { icon: <Calendar className="h-4 w-4" />, title: "Leave Quotas", hint: "Yearly quotas and monthly caps" },
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
                                Organization name <span className="text-red-500">*</span>
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
                                placeholder="Brief description of the organization..."
                                rows={4}
                                className="resize-none text-sm"
                                value={formData.description}
                                onChange={(e) => set("description", e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Organization logo</Label>
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
                                            "rounded-lg border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors",
                                            formData.workingDays.includes(day)
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
                                <Label htmlFor="shift-start">Shift start</Label>
                                <Input
                                    id="shift-start"
                                    type="time"
                                    value={formData.shiftStartTime}
                                    onChange={(e) => set("shiftStartTime", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="shift-end">Shift end</Label>
                                <Input
                                    id="shift-end"
                                    type="time"
                                    value={formData.shiftEndTime}
                                    onChange={(e) => set("shiftEndTime", e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="grace">Late grace window</Label>
                            <Select
                                value={String(formData.lateGraceMinutes)}
                                onValueChange={(v) => set("lateGraceMinutes", parseInt(v))}
                            >
                                <SelectTrigger id="grace" className="w-full">
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
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-5">
                        <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                            <p className="text-xs leading-relaxed text-indigo-700">
                                Set a location and radius for check-in and check-out. Leave both blank to skip geo-fencing.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Check-in point
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="in-lat">Latitude</Label>
                                    <Input
                                        id="in-lat"
                                        type="number"
                                        step="any"
                                        placeholder="e.g. 28.6139"
                                        value={formData.checkInLatitude}
                                        onChange={(e) => set("checkInLatitude", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="in-lng">Longitude</Label>
                                    <Input
                                        id="in-lng"
                                        type="number"
                                        step="any"
                                        placeholder="e.g. 77.2090"
                                        value={formData.checkInLongitude}
                                        onChange={(e) => set("checkInLongitude", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="in-radius">Check-in radius (meters)</Label>
                                <Input
                                    id="in-radius"
                                    type="number"
                                    min="1"
                                    value={formData.checkInRadiusMeters}
                                    onChange={(e) => set("checkInRadiusMeters", parseInt(e.target.value) || 100)}
                                />
                            </div>
                        </div>

                        <div className="space-y-3 border-t border-slate-100 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Check-out point
                            </p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="out-lat">Latitude</Label>
                                    <Input
                                        id="out-lat"
                                        type="number"
                                        step="any"
                                        placeholder="e.g. 28.6139"
                                        value={formData.checkOutLatitude}
                                        onChange={(e) => set("checkOutLatitude", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="out-lng">Longitude</Label>
                                    <Input
                                        id="out-lng"
                                        type="number"
                                        step="any"
                                        placeholder="e.g. 77.2090"
                                        value={formData.checkOutLongitude}
                                        onChange={(e) => set("checkOutLongitude", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="out-radius">Check-out radius (meters)</Label>
                                <Input
                                    id="out-radius"
                                    type="number"
                                    min="1"
                                    value={formData.checkOutRadiusMeters}
                                    onChange={(e) => set("checkOutRadiusMeters", parseInt(e.target.value) || 100)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-5">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="h-px flex-1 bg-slate-100" />
                                <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Yearly quota (days)
                                </p>
                                <span className="h-px flex-1 bg-slate-100" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {(
                                    [
                                        { label: "Employee", key: "employeeLeaveQuota", color: "bg-emerald-50 text-emerald-600" },
                                        { label: "Intern", key: "internLeaveQuota", color: "bg-amber-50 text-amber-600" },
                                        { label: "Contractual", key: "contractualLeaveQuota", color: "bg-violet-50 text-violet-600" },
                                    ] as const
                                ).map(({ label, key, color }) => (
                                    <div key={key} className="space-y-1.5">
                                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", color)}>
                                            {label}
                                        </span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="text-center font-semibold"
                                            value={formData[key]}
                                            onChange={(e) => set(key, parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="h-px flex-1 bg-slate-100" />
                                <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                    Monthly cap (days)
                                </p>
                                <span className="h-px flex-1 bg-slate-100" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {(
                                    [
                                        { label: "Employee", key: "employeeMonthlyCap", color: "bg-emerald-50 text-emerald-600" },
                                        { label: "Intern", key: "internMonthlyCap", color: "bg-amber-50 text-amber-600" },
                                        { label: "Contractual", key: "contractualMonthlyCap", color: "bg-violet-50 text-violet-600" },
                                    ] as const
                                ).map(({ label, key, color }) => (
                                    <div key={key} className="space-y-1.5">
                                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", color)}>
                                            {label}
                                        </span>
                                        <Input
                                            type="number"
                                            min="0"
                                            className="text-center font-semibold"
                                            value={formData[key]}
                                            onChange={(e) => set(key, parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="space-y-3">
                        <ReviewRow icon={<Building2 className="h-4 w-4" />} label="Name" value={formData.name} />
                        {logoFile && <ReviewRow label="Logo" value={logoFile.name} />}
                        {formData.description && <ReviewRow label="Description" value={formData.description} />}

                        <div className="space-y-2 pt-1">
                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Work schedule
                            </p>
                            <ReviewRow
                                icon={<Calendar className="h-4 w-4" />}
                                label="Working days"
                                value={formData.workingDays.join(", ")}
                            />
                            <ReviewRow
                                icon={<Clock className="h-4 w-4" />}
                                label="Shift"
                                value={`${formData.shiftStartTime} – ${formData.shiftEndTime}`}
                            />
                            <ReviewRow label="Grace window" value={`${formData.lateGraceMinutes} min`} />
                        </div>

                        <div className="space-y-2 pt-1">
                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Geo-fence
                            </p>
                            <ReviewRow
                                icon={<MapPin className="h-4 w-4" />}
                                label="Check-in"
                                value={
                                    formData.checkInLatitude && formData.checkInLongitude
                                        ? `${formData.checkInRadiusMeters}m radius`
                                        : "Not configured"
                                }
                            />
                            <ReviewRow
                                label="Check-out"
                                value={
                                    formData.checkOutLatitude && formData.checkOutLongitude
                                        ? `${formData.checkOutRadiusMeters}m radius`
                                        : "Not configured"
                                }
                            />
                        </div>

                        <div className="space-y-2 pt-1">
                            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                Leave quotas (yearly / monthly cap)
                            </p>
                            <ReviewRow
                                label="Employee"
                                value={`${formData.employeeLeaveQuota}d yearly · ${formData.employeeMonthlyCap}d/mo`}
                            />
                            <ReviewRow
                                label="Intern"
                                value={`${formData.internLeaveQuota}d yearly · ${formData.internMonthlyCap}d/mo`}
                            />
                            <ReviewRow
                                label="Contractual"
                                value={`${formData.contractualLeaveQuota}d yearly · ${formData.contractualMonthlyCap}d/mo`}
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
                    <Button type="button" className="w-full sm:w-auto" onClick={next}>
                        Continue
                    </Button>
                ) : (
                    <Button type="button" className="w-full sm:w-auto" onClick={handleSubmit} disabled={submitting}>
                        {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                        {submitting ? "Creating..." : "Create"}
                    </Button>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Edit Organization dialog
// ---------------------------------------------------------------------------

function EditOrgDialog({
    org,
    onClose,
    onSuccess,
}: {
    org: Organization
    onClose: () => void
    onSuccess: () => void
}) {
    const [form, setForm] = useState({
        name: org.name,
        description: org.description || "",
        workingDays: org.workingDays ? org.workingDays.split(",") : ["Mon", "Tue", "Wed", "Thu", "Fri"],
        shiftStartTime: org.shiftStartTime,
        shiftEndTime: org.shiftEndTime,
        lateGraceMinutes: org.lateGraceMinutes,
        checkInLatitude: org.latitude !== null ? String(org.latitude) : "",
        checkInLongitude: org.longitude !== null ? String(org.longitude) : "",
        checkInRadiusMeters: org.checkInRadiusMeters,
        checkOutLatitude: org.latitude !== null ? String(org.latitude) : "",
        checkOutLongitude: org.longitude !== null ? String(org.longitude) : "",
        checkOutRadiusMeters: org.checkOutRadiusMeters,
        employeeLeaveQuota: org.employeeLeaveQuota,
        internLeaveQuota: org.internLeaveQuota,
        contractualLeaveQuota: org.contractualLeaveQuota,
        employeeMonthlyCap: org.employeeMonthlyCap,
        internMonthlyCap: org.internMonthlyCap,
        contractualMonthlyCap: org.contractualMonthlyCap,
    })
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(org.logoUrl || null)
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }))

    const toggleDay = (day: string) => {
        setForm((prev) => ({
            ...prev,
            workingDays: prev.workingDays.includes(day)
                ? prev.workingDays.filter((d) => d !== day)
                : [...prev.workingDays, day],
        }))
    }

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
            setError("Organization name is required")
            return
        }
        if (form.workingDays.length === 0) {
            setError("Select at least one working day")
            return
        }
        setSubmitting(true)
        setError("")
        try {
            const payload = new FormData()
            payload.append("name", form.name)
            payload.append("description", form.description)
            payload.append("workingDays", form.workingDays.join(","))
            payload.append("shiftStartTime", form.shiftStartTime)
            payload.append("shiftEndTime", form.shiftEndTime)
            payload.append("lateGraceMinutes", String(form.lateGraceMinutes))
            payload.append("checkInLatitude", form.checkInLatitude)
            payload.append("checkInLongitude", form.checkInLongitude)
            payload.append("checkInRadiusMeters", String(form.checkInRadiusMeters))
            payload.append("checkOutLatitude", form.checkOutLatitude)
            payload.append("checkOutLongitude", form.checkOutLongitude)
            payload.append("checkOutRadiusMeters", String(form.checkOutRadiusMeters))
            payload.append("employeeLeaveQuota", String(form.employeeLeaveQuota))
            payload.append("internLeaveQuota", String(form.internLeaveQuota))
            payload.append("contractualLeaveQuota", String(form.contractualLeaveQuota))
            payload.append("employeeMonthlyCap", String(form.employeeMonthlyCap))
            payload.append("internMonthlyCap", String(form.internMonthlyCap))
            payload.append("contractualMonthlyCap", String(form.contractualMonthlyCap))
            if (logoFile) payload.append("logo", logoFile)

            const res = await fetch(`/api/organizations/${org.id}`, { method: "PATCH", body: payload })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Failed to update organization")
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
        <form onSubmit={handleSubmit} className="flex flex-col">
            <Tabs defaultValue="basic">
                <div className="px-5 pb-0 pt-3">
                    <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
                        <TabsTrigger value="basic" className="gap-1.5 text-xs">
                            <Building2 className="h-3.5 w-3.5" /> Basic
                        </TabsTrigger>
                        <TabsTrigger value="schedule" className="gap-1.5 text-xs">
                            <Clock className="h-3.5 w-3.5" /> Schedule
                        </TabsTrigger>
                        <TabsTrigger value="geofence" className="gap-1.5 text-xs">
                            <MapPin className="h-3.5 w-3.5" /> Geo-fence
                        </TabsTrigger>
                        <TabsTrigger value="quotas" className="gap-1.5 text-xs">
                            <Calendar className="h-3.5 w-3.5" /> Quotas
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="basic" className="mt-0 min-h-56 space-y-4 px-4 py-4 sm:px-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">
                            Organization name <span className="text-red-500">*</span>
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
                        <Label>Organization logo</Label>
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

                <TabsContent value="schedule" className="mt-0 min-h-56 space-y-5 px-4 py-4 sm:px-5">
                    <div className="space-y-2">
                        <Label>Working days</Label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(day)}
                                    className={cn(
                                        "rounded-lg border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors",
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
                            <Label htmlFor="edit-shift-start">Shift start</Label>
                            <Input
                                id="edit-shift-start"
                                type="time"
                                value={form.shiftStartTime}
                                onChange={(e) => set("shiftStartTime", e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-shift-end">Shift end</Label>
                            <Input
                                id="edit-shift-end"
                                type="time"
                                value={form.shiftEndTime}
                                onChange={(e) => set("shiftEndTime", e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-grace">Late grace window</Label>
                        <Select value={String(form.lateGraceMinutes)} onValueChange={(v) => set("lateGraceMinutes", parseInt(v))}>
                            <SelectTrigger id="edit-grace" className="w-full">
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
                    </div>
                </TabsContent>

                <TabsContent value="geofence" className="mt-0 min-h-56 space-y-4 px-4 py-4 sm:px-5">
                    <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Check-in point</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-in-lat">Latitude</Label>
                                <Input
                                    id="edit-in-lat"
                                    type="number"
                                    step="any"
                                    value={form.checkInLatitude}
                                    onChange={(e) => set("checkInLatitude", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-in-lng">Longitude</Label>
                                <Input
                                    id="edit-in-lng"
                                    type="number"
                                    step="any"
                                    value={form.checkInLongitude}
                                    onChange={(e) => set("checkInLongitude", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-in-radius">Check-in radius (meters)</Label>
                            <Input
                                id="edit-in-radius"
                                type="number"
                                min="1"
                                value={form.checkInRadiusMeters}
                                onChange={(e) => set("checkInRadiusMeters", parseInt(e.target.value) || 100)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Check-out point</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-out-lat">Latitude</Label>
                                <Input
                                    id="edit-out-lat"
                                    type="number"
                                    step="any"
                                    value={form.checkOutLatitude}
                                    onChange={(e) => set("checkOutLatitude", e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="edit-out-lng">Longitude</Label>
                                <Input
                                    id="edit-out-lng"
                                    type="number"
                                    step="any"
                                    value={form.checkOutLongitude}
                                    onChange={(e) => set("checkOutLongitude", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-out-radius">Check-out radius (meters)</Label>
                            <Input
                                id="edit-out-radius"
                                type="number"
                                min="1"
                                value={form.checkOutRadiusMeters}
                                onChange={(e) => set("checkOutRadiusMeters", parseInt(e.target.value) || 100)}
                            />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="quotas" className="mt-0 min-h-56 space-y-5 px-4 py-4 sm:px-5">
                    <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Yearly quota (days)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {(
                                [
                                    { label: "Employee", key: "employeeLeaveQuota", color: "bg-emerald-50 text-emerald-600" },
                                    { label: "Intern", key: "internLeaveQuota", color: "bg-amber-50 text-amber-600" },
                                    { label: "Contractual", key: "contractualLeaveQuota", color: "bg-violet-50 text-violet-600" },
                                ] as const
                            ).map(({ label, key, color }) => (
                                <div key={key} className="space-y-1.5">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", color)}>{label}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="text-center font-semibold"
                                        value={form[key]}
                                        onChange={(e) => set(key, parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Monthly cap (days)
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            {(
                                [
                                    { label: "Employee", key: "employeeMonthlyCap", color: "bg-emerald-50 text-emerald-600" },
                                    { label: "Intern", key: "internMonthlyCap", color: "bg-amber-50 text-amber-600" },
                                    { label: "Contractual", key: "contractualMonthlyCap", color: "bg-violet-50 text-violet-600" },
                                ] as const
                            ).map(({ label, key, color }) => (
                                <div key={key} className="space-y-1.5">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", color)}>{label}</span>
                                    <Input
                                        type="number"
                                        min="0"
                                        className="text-center font-semibold"
                                        value={form[key]}
                                        onChange={(e) => set(key, parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-600">
                        Changing yearly quotas updates the base leave balance for all existing users of that type.
                    </p>
                </TabsContent>
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
                <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
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

export default function OrganizationsPage() {
    const router = useRouter()
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [loading, setLoading] = useState(true)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [navigatingId, setNavigatingId] = useState<string | null>(null)

    useEffect(() => {
        fetchOrganizations()
    }, [])

    const fetchOrganizations = async () => {
        try {
            const res = await fetch("/api/organizations")
            const data = await res.json()
            if (res.ok) setOrganizations(data.organizations)
        } catch (err) {
            console.error("Error fetching organizations:", err)
        } finally {
            setLoading(false)
        }
    }

    const filteredOrgs = organizations.filter((org) =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleCreateSuccess = () => {
        setCreateDialogOpen(false)
        fetchOrganizations()
    }

    const openEditDialog = (org: Organization) => {
        setSelectedOrg(org)
        setEditDialogOpen(true)
    }

    const goToOrg = (org: Organization) => {
        setNavigatingId(org.id)
        router.push(`/organizations/${org.name}`)
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
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Organizations</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage every organization on the platform.</p>
                </div>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger className="cursor-pointer">
                        <Button className="h-9 px-4 font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New Organization
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] gap-0 overflow-hidden bg-white p-0 sm:min-w-xl max-h-[90vh]">
                        <DialogHeader className="border-b-0 px-6 pb-0 pt-5">
                            <DialogTitle className="text-base font-bold text-slate-900">New Organization</DialogTitle>
                            <DialogDescription className="sr-only">Create organization wizard</DialogDescription>
                        </DialogHeader>
                        <CreateOrgWizard onSuccess={handleCreateSuccess} onCancel={() => setCreateDialogOpen(false)} />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            {organizations.length > 0 && (
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search organizations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 pl-9 text-sm"
                    />
                </div>
            )}

            {/* Empty state */}
            {organizations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 py-20">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                        <Building2 className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="mb-1 font-semibold text-slate-900">No organizations yet</p>

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
                                        {org.shiftStartTime}–{org.shiftEndTime}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shift</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-slate-50 px-3 py-2.5">
                                    <span className="text-base font-bold text-slate-900">
                                        {org.latitude !== null ? `${org.checkInRadiusMeters}m` : "—"}
                                    </span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Radius</span>
                                </div>
                            </div>

                            {/* Leave quotas */}
                            <div className="flex-1 px-4 pb-3">
                                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Leave caps (d/yr)
                                </p>
                                <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                                    {(
                                        [
                                            { label: "Intern", quota: org.internLeaveQuota, cap: org.internMonthlyCap, color: "text-amber-600" },
                                            { label: "Employee", quota: org.employeeLeaveQuota, cap: org.employeeMonthlyCap, color: "text-emerald-600" },
                                            { label: "Contractual", quota: org.contractualLeaveQuota, cap: org.contractualMonthlyCap, color: "text-violet-600" },
                                        ] as const
                                    ).map(({ label, quota, cap, color }) => (
                                        <div key={label} className="flex items-center justify-between px-1">
                                            <span className="text-xs font-medium text-slate-500">{label}</span>
                                            <span className={cn("text-xs font-bold", color)}>
                                                {quota}d / cap {cap}d
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 pb-4 pt-1">
                                <p className="mb-2.5 flex items-center gap-1 text-[10px] text-slate-400">
                                    <CalendarDays className="h-3 w-3" />
                                    Created {format(new Date(org.createdAt), "MMM d, yyyy")}
                                </p>
                                <Button
                                    size="sm"
                                    className="h-8 w-full text-xs"
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
                <DialogContent className="w-[95vw] gap-0 overflow-hidden bg-white p-0 sm:max-w-xl">
                    <DialogHeader className="px-5 pb-0 pt-5">
                        <DialogTitle className="text-base font-bold text-slate-900">Edit Organization</DialogTitle>
                        <DialogDescription className="sr-only">Edit organization settings</DialogDescription>
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
                                fetchOrganizations()
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}