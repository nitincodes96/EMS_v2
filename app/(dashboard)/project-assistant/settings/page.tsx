"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { Camera, IdCard, Save } from "lucide-react"
import { toast } from "react-hot-toast"

import { Button } from "@/components/ui/button"
import Lanyard from "@/components/shared/lanyard"
import { cn } from "@/lib/utils"

type Profile = {
  id: string
  name: string | null
  username: string
  email: string | null
  empCode: string | null
  phoneNumber: string | null
  photoUrl: string | null
  role: string
  joiningDate: string | null
  createdAt: string
  department: { id: string; name: string; logoUrl: string | null } | null
}

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [username, setUsername] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/users/me")
      const data = await res.json()
      if (res.ok) {
        setProfile(data.user)
        setUsername(data.user.username)
        setPhotoPreview(data.user.photoUrl || null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = !!profile && (username.trim() !== profile.username || !!photoFile)

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Photo must be an image file")
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Photo must be smaller than 4MB")
      return
    }
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleDiscard() {
    if (!profile) return
    setUsername(profile.username)
    setPhotoFile(null)
    setPhotoPreview(profile.photoUrl || null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSave() {
    if (!profile || !dirty) return

    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3) {
      toast.error("Username must be at least 3 characters")
      return
    }

    setSaving(true)
    try {
      const formData = new FormData()
      if (trimmedUsername !== profile.username) formData.append("username", trimmedUsername)
      if (photoFile) formData.append("photo", photoFile)

      const res = await fetch("/api/users/me", { method: "PATCH", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to update profile")

      toast.success("Profile updated")
      setPhotoFile(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          <div className="space-y-5 lg:col-span-2">
            <div className="h-52 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
            <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div>
        <PageHeader />
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-900">Profile unavailable</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
            Your profile could not be retrieved. Please try again, or contact your department administrator if the
            problem persists.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-5 inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const displayName = profile.name || profile.username

  return (
    <div>
      <PageHeader />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Identity */}
        <section className="h-fit overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* Lanyard lives inside this white card; the string starts flush at the
              card's top edge and the badge hangs within. */}
          <div className="h-150 w-full">
            <Lanyard
              frontImage={photoPreview}
              frontTitle={displayName}
              frontSubtitle={formatRole(profile.role)}
              backImage={profile.department?.logoUrl}
              backTitle={profile.department?.name}
              theme="light"           // "light" for a white card
              strapColor="#4f46e5"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center px-6 pb-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden cursor-pointer"
              onChange={handlePhotoChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 underline-offset-4 transition-colors hover:text-slate-900 hover:underline"
            >
              <Camera className="h-4 w-4 cursor-pointer" /> Choose Photo
            </button>
            <p className="mt-1.5 text-[11px] text-slate-400">JPG, PNG or WebP · 4MB maximum</p>
          </div>

          {profile.empCode && (
            <div className="space-y-2.5 border-t border-slate-100 px-6 py-5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-600">
                <IdCard className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{profile.empCode}</span>
              </div>
            </div>
          )}
        </section>

        {/* Editable + read-only */}
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Account</h2>
              <p className="mt-0.5 text-xs text-slate-500">Your sign-in identity within the department.</p>
            </header>

            <div className="px-6 py-5">
              <label htmlFor="username" className="block text-xs font-medium text-slate-700">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
              <p className="mt-1.5 text-xs text-slate-400">Minimum 3 characters.</p>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
              <p className="text-xs text-slate-500">{dirty ? "Unsaved changes" : "All changes saved"}</p>
              <div className="ml-auto flex items-center gap-2">
                {dirty && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={saving}
                    className="h-9 rounded-md px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
                  >
                    Discard
                  </button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="h-9 cursor-pointer rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </footer>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white">
            <header className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900">Profile details</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Maintained by your department. Contact an administrator to request a change.
              </p>
            </header>

            <dl className="divide-y divide-slate-100 px-6">
              <Field label="Full name" value={profile.name} />
              <Field label="Email" value={profile.email} />
              <Field label="Phone number" value={profile.phoneNumber} />
              <Field label="Department" value={profile.department?.name} />
              <Field label="Employee code" value={profile.empCode} />
              <Field
                label="Joining date"
                value={profile.joiningDate ? format(new Date(profile.joiningDate), "d MMMM yyyy") : null}
              />
              <Field label="Member since" value={format(new Date(profile.createdAt), "d MMMM yyyy")} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  return (
    <header className="mb-6 border-b border-slate-200 pb-5">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        View your profile and update your username or photo.
      </p>
    </header>
  )
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6 py-3.5", className)}>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={cn("text-sm text-right", value ? "font-medium text-slate-900" : "text-slate-400")}>
        {value || "—"}
      </dd>
    </div>
  )
}

function formatRole(role: string) {
  const words = role.replace(/[_-]+/g, " ").trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}