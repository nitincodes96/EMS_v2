import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { passwordSchema } from "@/lib/validations/password"

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
    include: { department: { select: { name: true } } },
  })

  if (!user) {
    return NextResponse.json({ error: "Invite link is invalid" }, { status: 404 })
  }
  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Invite link has expired" }, { status: 410 })
  }

  return NextResponse.json({
    email: user.email,
    empCode: user.empCode,
    departmentName: user.department?.name ?? "",
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const user = await prisma.user.findUnique({ where: { inviteToken: token } })
  if (!user) {
    return NextResponse.json({ error: "Invite link is invalid" }, { status: 404 })
  }
  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Invite link has expired" }, { status: 410 })
  }

  try {
    const body = await request.json()
    const parsed = passwordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid password" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        status: "ACCEPTED",
        joiningDate: user.joiningDate ?? new Date(),
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    })

    return NextResponse.json({ email: user.email })
  } catch (error) {
    console.error("Error accepting invite:", error)
    return NextResponse.json({ error: "Failed to set password" }, { status: 500 })
  }
}
