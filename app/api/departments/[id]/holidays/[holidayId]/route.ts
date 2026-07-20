import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"

const VALID_TYPES = ["NATIONAL", "RELIGIOUS", "CUSTOM"]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; holidayId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, holidayId } = await params
  if (!canAccessDepartment(sessionUser, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } })
  if (!holiday || holiday.departmentId !== id) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { name, date, type } = body as { name?: string; date?: string; type?: string }

    const data: Prisma.HolidayUpdateInput = {}
    if (name !== undefined) data.name = name
    if (date !== undefined) data.date = new Date(date)
    if (type !== undefined) {
      const typeUpper = type.toUpperCase()
      if (!VALID_TYPES.includes(typeUpper)) {
        return NextResponse.json({ error: "Invalid holiday type" }, { status: 400 })
      }
      data.type = typeUpper as "NATIONAL" | "RELIGIOUS" | "CUSTOM"
    }

    const updated = await prisma.holiday.update({ where: { id: holidayId }, data })
    return NextResponse.json({ holiday: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Holiday already exists for this date" }, { status: 409 })
    }
    console.error("Error updating holiday:", error)
    return NextResponse.json({ error: "Failed to update holiday" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; holidayId: string }> }
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, holidayId } = await params
  if (!canAccessDepartment(sessionUser, id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } })
  if (!holiday || holiday.departmentId !== id) {
    return NextResponse.json({ error: "Holiday not found" }, { status: 404 })
  }

  await prisma.holiday.delete({ where: { id: holidayId } })
  return NextResponse.json({ message: "Holiday deleted" })
}
