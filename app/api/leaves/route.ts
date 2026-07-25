import { NextResponse } from "next/server"
import { differenceInCalendarDays, endOfYear, max, min, startOfYear } from "date-fns"
import type { Role } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { leaveRequestEmailHtml } from "@/lib/email-templates"
import { appLink, displayName, mailBrandName, notifyUsers } from "@/lib/notify"
import {
  approverRoleFor,
  findLeaveApprovers,
  leaveDateLabel,
  leaveDays,
  roleLabel,
} from "@/lib/leave-routing"

function countLeaveDays(startDate: Date, endDate: Date) {
  return differenceInCalendarDays(endDate, startDate) + 1
}

/** Where the approver lands when they follow the email's CTA. */
const REVIEW_PATH: Partial<Record<Role, string>> = {
  MODERATOR: "/moderator/leave",
  ADMIN: "/admin/leave",
}

/**
 * Tell everyone who can decide this request — Moderators for a PA's leave,
 * Admins for a Faculty member's — on the dashboard and by email. Delivery
 * problems are swallowed by notifyUsers so a flaky mail server can never lose
 * the request itself.
 */
async function notifyApprovers(leave: {
  id: string
  startDate: Date
  endDate: Date
  reason: string | null
  user: { name: string | null; username: string; email: string | null; role: Role }
  department: { name: string }
}) {
  const approvers = await findLeaveApprovers(leave.user.role)
  if (approvers.length === 0) {
    console.warn(
      `No active ${approverRoleFor(leave.user.role) ?? "approver"} to notify for leave ${leave.id}`
    )
    return
  }

  const requesterName = displayName(leave.user)
  const dateLabel = leaveDateLabel(leave.startDate, leave.endDate)
  const days = leaveDays(leave.startDate, leave.endDate)
  const brandName = await mailBrandName()
  const reviewLink = appLink(REVIEW_PATH[approverRoleFor(leave.user.role) ?? "MODERATOR"] ?? "/")

  await notifyUsers(
    approvers.map((approver) => ({
      userId: approver.id,
      type: "LEAVE" as const,
      title: "New leave request",
      message: `${requesterName} (${leave.department.name}) requested leave for ${dateLabel} · ${days} ${days === 1 ? "day" : "days"}.`,
      refId: leave.id,
      email: {
        to: approver.email,
        subject: `Leave request from ${requesterName} · ${leave.department.name}`,
        html: leaveRequestEmailHtml({
          brandName,
          approverName: displayName(approver),
          requesterName,
          requesterRoleLabel: roleLabel(leave.user.role),
          departmentName: leave.department.name,
          dateLabel,
          days,
          reason: leave.reason,
          reviewLink,
        }),
      },
    }))
  )
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      username: true,
      departmentId: true,
    },
  })

  if (!user || user.departmentId !== sessionUser.departmentId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const yearStart = startOfYear(new Date())
  const yearEnd = endOfYear(new Date())

  const approvedLeaves = await prisma.leave.findMany({
    where: {
      userId: user.id,
      departmentId: sessionUser.departmentId,
      status: "APPROVED",
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
    orderBy: { startDate: "desc" },
  })

  const pendingLeaves = await prisma.leave.count({
    where: {
      userId: user.id,
      departmentId: sessionUser.departmentId,
      status: "PENDING",
    },
  })

  const upcomingLeaves = await prisma.leave.findMany({
    where: {
      userId: user.id,
      departmentId: sessionUser.departmentId,
      endDate: { gte: new Date() },
      status: { in: ["PENDING", "APPROVED"] },
    },
    orderBy: { startDate: "asc" },
    take: 4,
  })

  const usedLeaveDays = approvedLeaves.reduce((total, leave) => {
    const overlapStart = max([leave.startDate, yearStart])
    const overlapEnd = min([leave.endDate, yearEnd])
    return total + Math.max(countLeaveDays(overlapStart, overlapEnd), 0)
  }, 0)

  const allLeaves = await prisma.leave.findMany({
    where: { userId: user.id },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json({
    summary: {
      usedLeaveDays,
      pendingLeaves,
    },
    upcomingLeaves: upcomingLeaves.map((leave) => ({
      id: leave.id,
      type: leave.reason || "Leave request",
      startDate: leave.startDate,
      endDate: leave.endDate,
      status: leave.status,
    })),
    leaves: allLeaves.map((leave) => ({
      id: leave.id,
      reason: leave.reason,
      startDate: leave.startDate,
      endDate: leave.endDate,
      status: leave.status,
      decisionRemark: leave.decisionRemark,
      createdAt: leave.createdAt,
    })),
  })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { startDate, endDate, reason } = body as {
      startDate: string
      endDate: string
      reason?: string
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    if (start < todayStart) {
      return NextResponse.json({ error: "Leave cannot be requested for past dates" }, { status: 400 })
    }

    const leave = await prisma.leave.create({
      data: {
        departmentId: sessionUser.departmentId,
        userId: sessionUser.id,
        startDate: start,
        endDate: end,
        reason: reason?.trim() || null,
        status: "PENDING",
      },
      include: {
        user: { select: { name: true, username: true, email: true, role: true } },
        department: { select: { name: true } },
      },
    })

    await notifyApprovers(leave)

    return NextResponse.json({ leave }, { status: 201 })
  } catch (error) {
    console.error("Error creating leave:", error)
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
  }
}
