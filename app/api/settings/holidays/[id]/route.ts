import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { logEvent } from "@/lib/system-log"

const VALID_TYPES = ["NATIONAL", "RELIGIOUS", "CUSTOM"]

// PATCH { name?, date?, type? }: admin edits a holiday.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const holiday = await prisma.holiday.findUnique({ where: { id } })
  if (!holiday) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
  }

  try {
    const body = (await request.json()) as { name?: string; date?: string; type?: string }

    const data: Prisma.HolidayUpdateInput = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
      data.name = name
    }
    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: "Invalid date" }, { status: 400 })
      }
      data.date = new Date(`${body.date}T00:00:00.000Z`)
    }
    if (body.type !== undefined) {
      const typeUpper = body.type.toUpperCase()
      if (!VALID_TYPES.includes(typeUpper)) {
        return NextResponse.json({ error: "Invalid holiday type" }, { status: 400 })
      }
      data.type = typeUpper as "NATIONAL" | "RELIGIOUS" | "CUSTOM"
    }

    const updated = await prisma.holiday.update({ where: { id }, data })

    await logEvent({
      category: "DEPARTMENT",
      action: "Holiday updated",
      description: `Updated holiday "${updated.name}" on ${updated.date.toISOString().slice(0, 10)}`,
      actor: sessionUser,
      entityType: "Holiday",
      entityId: id,
    })

    return NextResponse.json({ holiday: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That holiday already exists on that date" }, { status: 409 })
    }
    console.error("Error updating holiday:", error)
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 })
  }
}

// DELETE: admin removes a holiday.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const holiday = await prisma.holiday.findUnique({ where: { id } })
  if (!holiday) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
  }

  await prisma.holiday.delete({ where: { id } })

  await logEvent({
    category: "DEPARTMENT",
    action: "Holiday removed",
    description: `Removed holiday "${holiday.name}" on ${holiday.date.toISOString().slice(0, 10)}`,
    actor: sessionUser,
    entityType: "Holiday",
    entityId: id,
  })

  return NextResponse.json({ message: "Holiday deleted" })
}
