import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, hasRole } from "@/lib/api-auth"

// GET: list bookable Project Assistants (those currently checked in) in the
// caller's department (Faculty) or across departments (Admin).
// Availability is driven by attendance check-in / check-out (unified punch-in).
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !hasRole(sessionUser, "FACULTY", "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!sessionUser.departmentId && sessionUser.role === "FACULTY") {
    return NextResponse.json({ pas: [] })
  }

  const pas = await prisma.user.findMany({
    where: {
      role: "PROJECT_ASSISTANT",
      isActive: true,
      isAvailable: true,
      ...(sessionUser.role === "FACULTY" ? { departmentId: sessionUser.departmentId } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      photoUrl: true,
      availabilitySince: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: { availabilitySince: "asc" },
  })

  return NextResponse.json({ pas })
}
