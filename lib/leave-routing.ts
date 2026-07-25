import { differenceInCalendarDays } from "date-fns"
import type { Role } from "@prisma/client"

import prisma from "@/lib/prisma"
import type { SessionUser } from "@/lib/api-auth"

/**
 * Who decides a leave request, keyed by the role of whoever applied.
 *
 * Project Assistant leave is a Moderator's call and nobody else's — Faculty
 * raise the bookings, so keeping them out of the approval path stops a faculty
 * member from clearing (or blocking) their own PA's day. Faculty leave stays
 * with an Admin. Anything else has no defined route.
 */
const APPROVER_ROLE: Partial<Record<Role, Role>> = {
  PROJECT_ASSISTANT: "MODERATOR",
  FACULTY: "ADMIN",
}

export function approverRoleFor(requesterRole: Role): Role | undefined {
  return APPROVER_ROLE[requesterRole]
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  FACULTY: "Faculty",
  PROJECT_ASSISTANT: "Project Assistant",
  MODERATOR: "Moderator",
}

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role] ?? role
}

/**
 * Guard for deciding a leave request. Returns an error + status when the caller
 * may not decide it, or null when they may.
 */
export function checkLeaveDecisionAccess(
  sessionUser: SessionUser,
  leave: { user: { role: Role } }
): { error: string; status: number } | null {
  const required = approverRoleFor(leave.user.role)

  if (!required) {
    return { error: `${roleLabel(leave.user.role)} leave requests are not managed here`, status: 403 }
  }
  if (sessionUser.role !== required) {
    return {
      error: `Only a ${roleLabel(required)} can approve or reject ${roleLabel(leave.user.role)} leave requests`,
      status: 403,
    }
  }
  return null
}

/**
 * The people who should be told about a new leave request. Moderators work
 * organization-wide, so PA requests reach every moderator; admins likewise.
 */
export async function findLeaveApprovers(requesterRole: Role) {
  const role = approverRoleFor(requesterRole)
  if (!role) return []

  return prisma.user.findMany({
    where: { role, isActive: true },
    select: { id: true, name: true, username: true, email: true },
  })
}

/** Inclusive day count for a leave range. */
export function leaveDays(startDate: Date, endDate: Date): number {
  return differenceInCalendarDays(endDate, startDate) + 1
}

/**
 * Leave dates are stored as @db.Date (UTC midnight). Format them in UTC so the
 * label never slips a day on servers running behind UTC.
 */
const DATE_LABEL = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function leaveDateLabel(startDate: Date, endDate: Date): string {
  const start = DATE_LABEL.format(startDate)
  const end = DATE_LABEL.format(endDate)
  return start === end ? start : `${start} → ${end}`
}
