import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      username: true,
      basicSalary: true,
      hra: true,
      role: true,
      userType: true,
      isAvailable: true,
      availabilitySince: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const salary = (user.basicSalary ?? 0) + (user.hra ?? 0)

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      basicSalary: user.basicSalary,
      hra: user.hra,
      salary,
      role: user.role,
      userType: user.userType,
      isAvailable: user.isAvailable,
      availabilitySince: user.availabilitySince,
    },
  })
}