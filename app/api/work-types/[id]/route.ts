import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { normalizeWorkTypeName } from "@/lib/work-types"
import { logEvent } from "@/lib/system-log"

// PATCH { name }: admin renames a work type. Existing bookings keep the old
// text — they're a record of what was booked at the time.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  try {
    const body = (await request.json()) as { name?: unknown }
    const parsed = normalizeWorkTypeName(body.name)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const existing = await prisma.workType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Work type not found" }, { status: 404 })
    }

    const workType = await prisma.workType.update({ where: { id }, data: { name: parsed.name } })

    if (existing.name !== workType.name) {
      await logEvent({
        category: "DEPARTMENT",
        action: "Work type renamed",
        description: `Renamed work type "${existing.name}" → "${workType.name}"`,
        actor: sessionUser,
        entityType: "WorkType",
        entityId: id,
      })
    }

    return NextResponse.json({ workType })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A work type with that name already exists" }, { status: 409 })
    }
    console.error("Error renaming work type:", error)
    return NextResponse.json({ error: "Failed to rename work type" }, { status: 500 })
  }
}

// DELETE: admin removes a work type from the pick list. Bookings that used it
// keep their text; the last remaining type can't be removed.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  try {
    const existing = await prisma.workType.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Work type not found" }, { status: 404 })
    }
    const count = await prisma.workType.count()
    if (count <= 1) {
      return NextResponse.json({ error: "Keep at least one work type so faculty can still book" }, { status: 409 })
    }

    await prisma.workType.delete({ where: { id } })

    await logEvent({
      category: "DEPARTMENT",
      action: "Work type removed",
      description: `Removed work type "${existing.name}"`,
      actor: sessionUser,
      entityType: "WorkType",
      entityId: id,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing work type:", error)
    return NextResponse.json({ error: "Failed to remove work type" }, { status: 500 })
  }
}
