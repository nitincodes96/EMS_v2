import { NextResponse } from "next/server"
import { differenceInCalendarDays, format } from "date-fns"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

const DEFAULT_PAGE_SIZE = 15
const MAX_PAGE_SIZE = 100

// GET: leave requests across the organization, in any status.
// Admins can now decide Faculty leave (always could) and PA leave (alongside
// a Moderator, per lib/leave-routing) — so PENDING is included here too.
// Query: ?status=all|PENDING|APPROVED|REJECTED, ?departmentId=, ?q=, ?page=&limit=
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get("status") ?? "all"
  const departmentId = searchParams.get("departmentId")
  const q = (searchParams.get("q") ?? "").trim()
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )

  const statusWhere: Prisma.LeaveWhereInput =
    statusParam === "PENDING" || statusParam === "APPROVED" || statusParam === "REJECTED"
      ? { status: statusParam }
      : {}

  const where: Prisma.LeaveWhereInput = {
    ...statusWhere,
    ...(departmentId && departmentId !== "all" ? { departmentId } : {}),
    ...(q
      ? {
          user: {
            OR: [{ name: { contains: q } }, { email: { contains: q } }],
          },
        }
      : {}),
  }

  const [total, leaves, departments, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.leave.count({ where }),
    prisma.leave.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, photoUrl: true } },
        department: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    }),
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.leave.count({ where: { status: "PENDING" } }),
    prisma.leave.count({ where: { status: "APPROVED" } }),
    prisma.leave.count({ where: { status: "REJECTED" } }),
  ])

  return NextResponse.json({
    leaves: leaves.map((l) => ({
      id: l.id,
      reason: l.reason,
      startDate: format(l.startDate, "yyyy-MM-dd"),
      endDate: format(l.endDate, "yyyy-MM-dd"),
      days: differenceInCalendarDays(l.endDate, l.startDate) + 1,
      status: l.status,
      decisionRemark: l.decisionRemark,
      decidedAt: l.decidedAt,
      createdAt: l.createdAt,
      user: l.user,
      department: l.department,
      approver: l.approver ? l.approver.name : null,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    departments,
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      all: pendingCount + approvedCount + rejectedCount,
    },
  })
}
