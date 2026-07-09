export function normalizeUploadedAssetUrl(url?: string | null): string | null | undefined {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("data:") || url.startsWith("blob:")) return url
  if (url.startsWith("/api/upload/")) return url
  const cleaned = url.replace(/^\/?(uploads\/)?/i, "")
  return `/api/upload/${cleaned}`
}
