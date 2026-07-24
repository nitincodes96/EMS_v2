import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export type SessionUser = {
  id: string
  email: string | null
  role: "ADMIN" | "FACULTY" | "PROJECT_ASSISTANT" | "MODERATOR"
  departmentId: string | null
}

export async function getSessionUser(): Promise<SessionUser | undefined> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return undefined
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    role: session.user.role as SessionUser["role"],
    departmentId: session.user.departmentId ?? null,
  }
}

// MODERATOR is intentionally excluded: their remit is organization-wide but limited
// to PA leave decisions, so the leave routes gate them explicitly instead.
export function canAccessDepartment(user: SessionUser, departmentId: string): boolean {
  if (user.role === "ADMIN") return true
  if (user.role === "FACULTY") return user.departmentId === departmentId
  return false
}

export function hasRole(user: SessionUser, ...roles: SessionUser["role"][]): boolean {
  return roles.includes(user.role)
}
