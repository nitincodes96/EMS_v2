import { NextResponse } from "next/server"
import { startOfDay, endOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  const org = await prisma.department.findUnique({ where: { slug } })
  if (!org) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }

  if (!canAccessDepartment(sessionUser, org.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // NOTE: "today" is computed against the server process's local timezone,
  // which may not match the department's actual local day boundary.
  // No per-org timezone field exists yet to correct for this.
  const now = new Date()
  const dayStart = startOfDay(now)
  const dayEnd = endOfDay(now)

  // Never hand the client a raw user row — it carries the password hash, OTP
  // and the invite/reset tokens. Only these fields are needed by the UI.
  const USER_SELECT = {
    id: true,
    email: true,
    empCode: true,
    name: true,
    photoUrl: true,
    phoneNumber: true,
    role: true,
    isActive: true,
    status: true,
    joiningDate: true,
    createdAt: true,
  } as const

  const [users, leaves, attendances] = await Promise.all([
    prisma.user.findMany({
      where: { departmentId: org.id },
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.leave.findMany({
      where: { departmentId: org.id, status: "PENDING" },
      include: { user: { select: USER_SELECT } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.attendance.findMany({
      where: { departmentId: org.id, date: { gte: dayStart, lte: dayEnd } },
      include: { user: { select: USER_SELECT } },
    }),
  ])

  const presentUserIds = new Set(attendances.map((a) => a.userId))
  // Attendance is punched by Project Assistants only — Faculty and Moderators
  // never check in, so listing them as "absent" would flag them every day.
  const absentUsers = users.filter(
    (u) => u.isActive && u.role === "PROJECT_ASSISTANT" && !presentUserIds.has(u.id)
  )

  const stats = {
    adminsCount: users.filter((u) => u.role === "FACULTY").length,
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
    department: {
      id: org.id,
      name: org.name,
      description: org.description,
      logoUrl: org.logoUrl,
      createdAt: org.createdAt,
      users,
      leaves,
      attendances: reshapedAttendances,
      absentUsers,
      stats,
    },
  })
}
