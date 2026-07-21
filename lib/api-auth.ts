import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export type SessionUser = {
  id: string
  email: string
  role: "ADMIN" | "FACULTY" | "PROJECT_ASSISTANT"
  departmentId: string | null
}

export async function getSessionUser(): Promise<SessionUser | undefined> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return undefined
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role as SessionUser["role"],
    departmentId: session.user.departmentId ?? null,
  }
}

export function canAccessDepartment(user: SessionUser, departmentId: string): boolean {
  if (user.role === "ADMIN") return true
  if (user.role === "FACULTY") return user.departmentId === departmentId
  return false
}

export function hasRole(user: SessionUser, ...roles: SessionUser["role"][]): boolean {
  return roles.includes(user.role)
}
