import prisma from "@/lib/prisma"

/**
 * Work types a faculty can pick when booking a PA. Admin-managed (Schedule
 * settings → Work types); this module is the only reader. The starter set is
 * seeded the first time the table is read while empty, so a fresh install
 * has something to pick from.
 */

const STARTER_WORK_TYPES = [
  "Data Entry",
  "Lab Assistance",
  "Field Work",
  "Documentation",
  "Research Support",
  "Other",
]

export const MAX_WORK_TYPE_LENGTH = 60

export async function listWorkTypes() {
  const existing = await prisma.workType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
  if (existing.length > 0) return existing

  await prisma.workType.createMany({
    data: STARTER_WORK_TYPES.map((name, i) => ({ name, sortOrder: i })),
    skipDuplicates: true,
  })
  return prisma.workType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
}

/** Trimmed, length-checked name or an error message. */
export function normalizeWorkTypeName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : ""
  if (!name) return { ok: false, error: "Work type name is required" }
  if (name.length > MAX_WORK_TYPE_LENGTH) {
    return { ok: false, error: `Work type name must be ${MAX_WORK_TYPE_LENGTH} characters or fewer` }
  }
  return { ok: true, name }
}

/** True when the value is one of the currently configured work types. */
export async function isValidWorkType(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !value.trim()) return false
  const types = await listWorkTypes()
  return types.some((t) => t.name === value)
}
