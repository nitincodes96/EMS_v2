import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const leave = await prisma.leave.findUnique({ where: { id } })
  if (!leave) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 })
  }
  if (!canAccessDepartment(sessionUser, leave.departmentId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { status } = body as { status: string }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.leave.update({ where: { id }, data: { status } })
    return NextResponse.json({ leave: updated })
  } catch (error) {
    console.error("Error updating leave:", error)
    return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
  }
}
