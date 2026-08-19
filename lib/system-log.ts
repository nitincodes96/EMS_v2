import prisma from "@/lib/prisma"
import type { Role, SystemLogCategory } from "@prisma/client"

/** Whoever performed the action. Undefined/null = no signed-in actor. */
export type LogActor =
  | {
      id?: string | null
      name?: string | null
      email?: string | null
      empCode?: string | null
      role?: Role | null
    }
  | null
  | undefined

/**
 * Writes one entry to the site-wide audit trail behind the admin System Logs
 * page (SystemLog).
 *
 * Logging must never break the action it describes — a failed insert here
 * should not roll back a booking or a leave decision — so every error is
 * swallowed and reported to the server console, exactly like notifyUser().
 * Returns whether the entry was actually recorded.
 */
export async function logEvent(input: {
  category: SystemLogCategory
  /** Short verb phrase shown in the Action column, e.g. "Booking cancelled". */
  action: string
  /** One-line human sentence shown in the Description column. */
  description: string
  actor?: LogActor
  /** What the event was about, e.g. "Booking" + its id. */
  entityType?: string | null
  entityId?: string | null
  departmentId?: string | null
}): Promise<boolean> {
  try {
    const actor = await resolveActor(input.actor)

    await prisma.systemLog.create({
      data: {
        category: input.category,
        action: input.action,
        description: input.description,
        actorId: input.actor?.id ?? null,
        actorLabel: actorLabel(actor),
        actorRole: actor?.role ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        departmentId: input.departmentId ?? null,
      },
    })
    return true
  } catch (error) {
    console.error("Failed to write system log:", error)
    return false
  }
}

/**
 * Session users only carry id/email/role, so when a call site passes one
 * straight through we fill in the display name from the database. Call sites
 * that already hold the full user (a freshly created account, an invited PA)
 * pass a name and skip the lookup entirely.
 */
async function resolveActor(actor: LogActor): Promise<LogActor> {
  if (!actor?.id || actor.name) return actor
  const found = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { name: true, email: true, empCode: true, role: true },
  })
  return found ? { id: actor.id, ...found } : actor
}

/**
 * Best available display name, snapshotted at write time so the entry stays
 * readable after the account is renamed or deleted. Null means the event had
 * no signed-in actor (self-registration, an accepted invite, a cron job).
 */
function actorLabel(actor: LogActor): string | null {
  if (!actor) return null
  return actor.name?.trim() || actor.email?.trim() || actor.empCode?.trim() || null
}
