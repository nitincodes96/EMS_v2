"use client"

import { cn } from "@/lib/utils"
import { normalizeUploadedAssetUrl } from "@/lib/upload-urls"

const GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
]

function initialsOf(text: string): string {
  return (
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function gradientOf(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash)
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

export function EntityAvatar({
  name,
  fallbackText,
  imageUrl,
  rounded = "full",
  fit = "cover",
  size = "md",
  className,
}: {
  name?: string | null
  fallbackText?: string | null
  imageUrl?: string | null
  rounded?: "full" | "xl"
  fit?: "cover" | "contain"
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const label = (name || fallbackText || "?").trim()
  const roundedClass = rounded === "xl" ? "rounded-xl" : "rounded-full"
  const textSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-sm"
  const resolvedUrl = normalizeUploadedAssetUrl(imageUrl)
  const displayUrl = imageUrl?.startsWith("data:") || imageUrl?.startsWith("blob:") ? imageUrl : resolvedUrl

  if (displayUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={displayUrl}
        alt={label}
        className={cn(fit === "contain" ? "object-contain" : "object-cover", roundedClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-linear-to-br font-semibold text-white",
        gradientOf(label),
        roundedClass,
        textSize,
        className
      )}
    >
      {initialsOf(label)}
    </div>
  )
}
