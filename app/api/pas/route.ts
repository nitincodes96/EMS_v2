import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"

// GET: directory of active Project Assistants a faculty can book.
//  - FACULTY: PAs in their own department
//  - ADMIN: PAs across all departments (optionally ?departmentId=)
// Unlike /api/availability (live punched-in only), this returns the full
// bookable roster so slots can be scheduled for any chosen day.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (sessionUser.role === "FACULTY" && !sessionUser.departmentId) {
    return NextResponse.json({ pas: [] })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")

  const departmentFilter =
    sessionUser.role === "FACULTY"
      ? { departmentId: sessionUser.departmentId }
      : departmentIdParam && departmentIdParam !== "all"
        ? { departmentId: departmentIdParam }
        : {}

  const pas = await prisma.user.findMany({
    where: {
      role: "PROJECT_ASSISTANT",
      isActive: true,
      ...departmentFilter,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phoneNumber: true,
      photoUrl: true,
      isAvailable: true,
      availabilitySince: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ isAvailable: "desc" }, { name: "asc" }],
  })

  return NextResponse.json({ pas })
}
