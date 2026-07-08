import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessOrganization } from "@/lib/api-auth"

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  const org = await prisma.organization.findUnique({ where: { slug } })
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  if (!canAccessOrganization(sessionUser, org.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // NOTE: "today" is computed against the server process's local timezone,
  // which may not match the organization's actual local day boundary.
  // No per-org timezone field exists yet to correct for this.
  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)

  const [users, holidays, leaves, attendances] = await Promise.all([
    prisma.user.findMany({ where: { organizationId: org.id }, orderBy: { createdAt: "desc" } }),
    prisma.holiday.findMany({ where: { organizationId: org.id }, orderBy: { date: "asc" } }),
    prisma.leave.findMany({
      where: { organizationId: org.id, status: "PENDING" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendance.findMany({
      where: { organizationId: org.id, date: { gte: dayStart, lte: dayEnd } },
      include: { user: true },
    }),
  ])

  const presentUserIds = new Set(attendances.map((a) => a.userId))
  const absentUsers = users.filter(
    (u) => u.isActive && u.role !== "SUPER_ADMIN" && !presentUserIds.has(u.id)
  )

  const stats = {
    adminsCount: users.filter((u) => u.role === "ADMIN").length,
    activeUsersCount: users.filter((u) => u.isActive).length,
    inactiveUsersCount: users.filter((u) => !u.isActive).length,
    totalUsersCount: users.length,
    pendingLeavesCount: leaves.length,
  }

  const reshapedAttendances = attendances.map((a) => ({
    id: a.id,
    checkInTime: a.checkInTime,
    checkOutTime: a.checkOutTime,
    latitude: a.checkInLatitude,
    longitude: a.checkInLongitude,
    user: a.user,
  }))

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      description: org.description,
      logoUrl: org.logoUrl,
      employeeLeaveQuota: org.employeeLeaveQuota,
      internLeaveQuota: org.internLeaveQuota,
      contractualLeaveQuota: org.contractualLeaveQuota,
      createdAt: org.createdAt,
      users,
      holidays,
      leaves,
      attendances: reshapedAttendances,
      absentUsers,
      stats,
    },
  })
}
