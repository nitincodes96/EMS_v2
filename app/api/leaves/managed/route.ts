import { NextResponse } from "next/server"
import { differenceInCalendarDays } from "date-fns"
import type { Prisma } from "@prisma/client"

import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: every leave request the caller is responsible for, in any status.
// Unlike /api/leaves/pending this includes decided requests, so approver
// screens can show history and counts alongside the queue.
//  - FACULTY:   PA leaves in their own department.
//  - MODERATOR: PA leaves across every department in the organization.
//  - ADMIN:     Faculty + PA leaves, optionally narrowed by ?departmentId=.
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
  const statusParam = searchParams.get("status")

  const scope: Prisma.LeaveWhereInput =
    sessionUser.role === "FACULTY"
      ? {
          departmentId: sessionUser.departmentId ?? "__none__",
          user: { role: "PROJECT_ASSISTANT" },
        }
      : sessionUser.role === "MODERATOR"
        ? { user: { role: "PROJECT_ASSISTANT" } }
        : {
            ...(departmentIdParam && departmentIdParam !== "all"
              ? { departmentId: departmentIdParam }
              : {}),
            user: { role: { in: ["FACULTY", "PROJECT_ASSISTANT"] } },
          }

  const isKnownStatus =
    statusParam === "PENDING" || statusParam === "APPROVED" || statusParam === "REJECTED"

  const leaves = await prisma.leave.findMany({
    where: isKnownStatus ? { ...scope, status: statusParam } : scope,
    include: {
      user: { select: { id: true, name: true, username: true, email: true, role: true, photoUrl: true } },
      department: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  })

  // Counts always describe the caller's full scope, not the filtered slice.
  const grouped = await prisma.leave.groupBy({
    by: ["status"],
    where: scope,
    _count: { _all: true },
  })

  const countFor = (status: "PENDING" | "APPROVED" | "REJECTED") =>
    grouped.find((row) => row.status === status)?._count._all ?? 0

  return NextResponse.json({
    leaves: leaves.map((leave) => ({
      id: leave.id,
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: differenceInCalendarDays(leave.endDate, leave.startDate) + 1,
      reason: leave.reason,
      status: leave.status,
      decisionRemark: leave.decisionRemark,
      decidedAt: leave.decidedAt,
      createdAt: leave.createdAt,
      user: leave.user,
      department: leave.department,
      approver: leave.approver,
    })),
    summary: {
      pending: countFor("PENDING"),
      approved: countFor("APPROVED"),
      rejected: countFor("REJECTED"),
    },
  })
}
