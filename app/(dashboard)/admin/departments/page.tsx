"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
} from "@/components/ui/dialog"
import {
    Plus,
    Users,
    Building2,
    Edit,
    Loader2,
    CalendarDays,
    Search,
    ImagePlus,
    SlidersHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A department is just a name, a description, a logo and its people. Working
 * hours, booking rules, geo-fence locations and holidays are organization-wide
 * — see Global Settings.
 */
interface Department {
    id: string
    name: string
    slug: string
    description: string | null
    logoUrl: string | null
    createdAt: string
    adminCount: number
    userCount: number
    _count: {
        users: number
        leaves: number
        attendances: number
    }
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
        return (
            // eslint-disable-next-line @next/next/no-img-element
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

// ---------------------------------------------------------------------------
// Create / edit form (same fields for both)
// ---------------------------------------------------------------------------

function DepartmentForm({
    org,
    onCancel,
    onSuccess,
}: {
    /** Undefined = creating a new department. */
    org?: Department
    onCancel: () => void
    onSuccess: () => void
}) {
    const [name, setName] = useState(org?.name ?? "")
    const [description, setDescription] = useState(org?.description ?? "")
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(org?.logoUrl ?? null)
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

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
        setError("")
        setLogoFile(file)
        const reader = new FileReader()
        reader.onload = () => setLogoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError("Department name is required.")
            return
        }
        setSubmitting(true)
        setError("")
        try {
            const payload = new FormData()
            payload.append("name", name.trim())
            payload.append("description", description)
            if (logoFile) payload.append("logo", logoFile)

            const res = org
                ? await fetch(`/api/departments/${org.id}`, { method: "PATCH", body: payload })
                : await fetch("/api/departments", { method: "POST", body: payload })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || (org ? "Failed to update department" : "Failed to create department"))
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
            <div className="space-y-4 px-4 py-4 sm:px-5">
                <div className="space-y-1.5">
                    <Label htmlFor="dept-name">
                        Department name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                        id="dept-name"
                        placeholder="e.g. Computer Science"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="dept-desc">Description</Label>
                    <Textarea
                        id="dept-desc"
                        placeholder="Brief description of the department..."
                        rows={4}
                        className="resize-none text-sm"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Department logo</Label>
                    <div className="flex items-center gap-4">
                        <label className="flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-indigo-400 hover:text-indigo-500">
                            {logoPreview ? (
                                <OrgAvatar name={name} logoUrl={logoPreview} className="h-full w-full" />
                            ) : (
                                <ImagePlus className="h-5 w-5" />
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                        </label>
                        <p className="text-xs text-slate-400">
                            PNG, JPG or WEBP. Max 2MB. {org ? "Upload a new image to replace the current logo." : "Optional — add this later."}
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                    <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                    <p className="text-xs leading-relaxed text-indigo-700">
                        Working hours, booking rules, geo-fence locations and holidays are shared by every
                        department — manage them in{" "}
                        <Link href="/admin/global-settings" className="font-semibold underline underline-offset-2">
                            Global Settings
                        </Link>
                        .
                    </p>
                </div>

                {error && (
                    <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
                        {error}
                    </p>
                )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
                <Button type="button" variant="outline" className="w-full cursor-pointer sm:w-auto" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" className="w-full cursor-pointer sm:w-auto" disabled={submitting}>
                    {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    {submitting ? (org ? "Saving..." : "Creating...") : org ? "Save changes" : "Create department"}
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
    const [selectedOrg, setSelectedOrg] = useState<Department | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [navigatingId, setNavigatingId] = useState<string | null>(null)

    const fetchDepartments = useCallback(async () => {
        try {
            const res = await fetch("/api/departments")
            const data = await res.json()
            if (res.ok) setDepartments(data.departments)
        } catch (err) {
            console.error("Error fetching departments:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchDepartments()
    }, [fetchDepartments])

    const filteredOrgs = departments.filter((org) =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

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
                        className="h-9 cursor-pointer px-4 font-semibold"
                        render={<Link href="/admin/global-settings" />}
                    >
                        <SlidersHorizontal className="mr-1.5 h-4 w-4 text-indigo-600" />
                        Global settings
                    </Button>
                    <Button
                        className="h-9 cursor-pointer bg-indigo-600 px-4 font-semibold text-white hover:bg-indigo-700"
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        <Plus className="mr-1.5 h-4 w-4" />
                        New Department
                    </Button>
                </div>
            </div>

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
                                        onClick={() => setSelectedOrg(org)}
                                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                                        aria-label={`Edit ${org.name}`}
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
                                    <span className="text-base font-bold text-slate-900">{org.adminCount}</span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Faculty</span>
                                </div>
                                <div className="flex flex-col items-center gap-0.5 bg-slate-50 px-3 py-2.5">
                                    <span className="text-base font-bold text-slate-900">{org.userCount}</span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">PAs</span>
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
                                    className="h-8 w-full cursor-pointer bg-indigo-500 text-xs hover:bg-indigo-600"
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

            {/* Create dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden bg-white p-0 sm:max-w-lg">
                    <DialogHeader className="px-5 pb-0 pt-5">
                        <DialogTitle className="text-base font-bold text-slate-900">New Department</DialogTitle>
                        <DialogDescription className="sr-only">Create a department</DialogDescription>
                    </DialogHeader>
                    <DepartmentForm
                        onCancel={() => setCreateDialogOpen(false)}
                        onSuccess={() => {
                            setCreateDialogOpen(false)
                            void fetchDepartments()
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={selectedOrg !== null} onOpenChange={(open) => !open && setSelectedOrg(null)}>
                <DialogContent className="w-[95vw] gap-0 overflow-hidden bg-white p-0 sm:max-w-lg">
                    <DialogHeader className="px-5 pb-0 pt-5">
                        <DialogTitle className="text-base font-bold text-slate-900">Edit Department</DialogTitle>
                        <DialogDescription className="sr-only">Edit department details</DialogDescription>
                    </DialogHeader>
                    {selectedOrg && (
                        <DepartmentForm
                            org={selectedOrg}
                            onCancel={() => setSelectedOrg(null)}
                            onSuccess={() => {
                                setSelectedOrg(null)
                                void fetchDepartments()
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
