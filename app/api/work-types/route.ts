import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { listWorkTypes, normalizeWorkTypeName } from "@/lib/work-types"
import { logEvent } from "@/lib/system-log"

// GET: the work types a faculty can pick from. Any signed-in user.
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const workTypes = await listWorkTypes()
  return NextResponse.json({ workTypes })
}

// POST { name }: admin adds a work type. Appended to the end of the list.
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { name?: unknown }
    const parsed = normalizeWorkTypeName(body.name)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const last = await prisma.workType.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
    const workType = await prisma.workType.create({
      data: { name: parsed.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
    })

    await logEvent({
      category: "DEPARTMENT",
      action: "Work type added",
      description: `Added work type "${workType.name}"`,
      actor: sessionUser,
      entityType: "WorkType",
      entityId: workType.id,
    })

    return NextResponse.json({ workType }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A work type with that name already exists" }, { status: 409 })
    }
    console.error("Error adding work type:", error)
    return NextResponse.json({ error: "Failed to add work type" }, { status: 500 })
  }
}
