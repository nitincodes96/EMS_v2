import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ authenticated: false, isActive: false })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, role: true, organizationId: true },
  })

  if (!user) {
    return NextResponse.json({ authenticated: false, isActive: false })
  }

  return NextResponse.json({
    authenticated: true,
    isActive: user.isActive,
    role: user.role,
    organizationId: user.organizationId,
  })
}