import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessOrganization } from "@/lib/api-auth"

const VALID_TYPES = ["NATIONAL", "RELIGIOUS", "CUSTOM"]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!canAccessOrganization(sessionUser, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, date, type } = body as { name: string; date: string; type: string }

    const typeUpper = String(type || "").toUpperCase()
    if (!name || !date || !VALID_TYPES.includes(typeUpper)) {
      return NextResponse.json({ error: "Invalid holiday data" }, { status: 400 })
    }

    const holiday = await prisma.holiday.create({
      data: { organizationId: id, name, date: new Date(date), type: typeUpper as "NATIONAL" | "RELIGIOUS" | "CUSTOM" },
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Holiday already exists for this date" }, { status: 409 })
    }
    console.error("Error creating holiday:", error)
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 })
  }
}
