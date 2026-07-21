import { NextResponse } from "next/server"
import { differenceInCalendarDays, endOfYear, max, min, startOfYear } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

function countLeaveDays(startDate: Date, endDate: Date) {
  return differenceInCalendarDays(endDate, startDate) + 1
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
      userType: true,
      baseLeaveQuota: true,
      extraLeaveQuota: true,
      departmentId: true,
    },
  })

  if (!user || user.departmentId !== sessionUser.departmentId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const totalQuota = user.baseLeaveQuota + user.extraLeaveQuota
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

  const balance = Math.max(totalQuota - usedLeaveDays, 0)

  const allLeaves = await prisma.leave.findMany({
    where: { userId: user.id },
    orderBy: { startDate: "desc" },
  })

  return NextResponse.json({
    summary: {
      totalQuota,
      usedLeaveDays,
      balance,
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
      leaveType: leave.leaveType,
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
    const { startDate, endDate, reason, leaveType } = body as {
      startDate: string
      endDate: string
      reason?: string
      leaveType?: string
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    const VALID_LEAVE_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID", "OTHER"] as const
    const resolvedType = VALID_LEAVE_TYPES.includes(leaveType as (typeof VALID_LEAVE_TYPES)[number])
      ? (leaveType as (typeof VALID_LEAVE_TYPES)[number])
      : "CASUAL"

    const leave = await prisma.leave.create({
      data: {
        departmentId: sessionUser.departmentId,
        userId: sessionUser.id,
        startDate: start,
        endDate: end,
        leaveType: resolvedType,
        reason: reason || null,
        status: "PENDING",
      },
    })

    return NextResponse.json({ leave }, { status: 201 })
  } catch (error) {
    console.error("Error creating leave:", error)
    return NextResponse.json({ error: "Failed to create leave request" }, { status: 500 })
  }
}
