import prisma from "@/lib/prisma"

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "org"
  )
}

export async function generateUniqueOrgSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name)
  let candidate = base
  let n = 1
  while (true) {
    const existing = await prisma.department.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
    n += 1
    candidate = `${base}-${n}`
  }
}
