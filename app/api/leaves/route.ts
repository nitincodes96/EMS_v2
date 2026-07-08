import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { startDate, endDate, reason } = body as { startDate: string; endDate: string; reason?: string }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const leave = await prisma.leave.create({
      data: {
        organizationId: sessionUser.organizationId,
        userId: sessionUser.id,
        startDate: start,
        endDate: end,
        reason: reason || null,
        status: "PENDING",
      },
    })

    return NextResponse.json({ leave }, { status: 201 })
  } catch (error) {
    console.error("Error creating leave:", error)
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
  }
}
