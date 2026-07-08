import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export type SessionUser = {
  id: string
  email: string
  role: "SUPER_ADMIN" | "ADMIN" | "USER"
  organizationId: string | null
}

export async function getSessionUser(): Promise<SessionUser | undefined> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return undefined
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role as SessionUser["role"],
    organizationId: session.user.organizationId ?? null,
  }
}

export function canAccessOrganization(user: SessionUser, organizationId: string): boolean {
  if (user.role === "SUPER_ADMIN") return true
  if (user.role === "ADMIN") return user.organizationId === organizationId
  return false
}
