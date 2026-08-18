import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: leave requests awaiting the caller's decision (approver view).
//  - MODERATOR: pending PA leaves across every department (FR-6.2).
//  - ADMIN: pending Faculty leaves (FR-6.3), optional ?departmentId=.
// Faculty do not decide leave, so they get nothing here — see lib/leave-routing.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")

  const where =
    sessionUser.role === "MODERATOR"
      ? {
          status: "PENDING" as const,
          user: { role: "PROJECT_ASSISTANT" as const },
        }
      : {
          status: "PENDING" as const,
          ...(departmentIdParam && departmentIdParam !== "all" ? { departmentId: departmentIdParam } : {}),
          user: { role: "FACULTY" as const },
        }

  const leaves = await prisma.leave.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, role: true, photoUrl: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ leaves })
}
