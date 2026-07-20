import NextAuth, { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      departmentId: string | null
      photoUrl: string | null
      isActive: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    role: string
    departmentId?: string | null
    photoUrl?: string | null
    isActive?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    departmentId?: string | null
    photoUrl?: string | null
    isActive?: boolean
  }
}
