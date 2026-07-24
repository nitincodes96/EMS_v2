import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: leave requests awaiting the caller's decision (approver view).
//  - FACULTY: pending PA leaves in their department (FR-6.2).
//  - MODERATOR: pending PA leaves across every department in the organization.
//  - ADMIN: all pending Faculty + PA leaves (FR-6.3), optional ?departmentId=.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (
    !sessionUser ||
    (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY" && sessionUser.role !== "MODERATOR")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")

  const where =
    sessionUser.role === "FACULTY"
      ? {
          status: "PENDING" as const,
          departmentId: sessionUser.departmentId ?? "__none__",
          user: { role: "PROJECT_ASSISTANT" as const },
        }
      : sessionUser.role === "MODERATOR"
        ? {
            status: "PENDING" as const,
            user: { role: "PROJECT_ASSISTANT" as const },
          }
        : {
            status: "PENDING" as const,
            ...(departmentIdParam && departmentIdParam !== "all" ? { departmentId: departmentIdParam } : {}),
            user: { role: { in: ["FACULTY" as const, "PROJECT_ASSISTANT" as const] } },
          }

  const leaves = await prisma.leave.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, username: true, email: true, role: true, photoUrl: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ leaves })
}
