import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "No department associated with this account" }, { status: 404 })
  }

  const department = await prisma.department.findUnique({
    where: { id: sessionUser.departmentId },
    include: {
      locations: true,
      holidays: {
        orderBy: { date: "asc" },
      },
    },
  })

  if (!department) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 })
  }

  return NextResponse.json({
    department: {
      id: department.id,
      name: department.name,
      description: department.description,
      logoUrl: department.logoUrl,
      employeeLeaveQuota: department.employeeLeaveQuota,
      internLeaveQuota: department.internLeaveQuota,
      contractualLeaveQuota: department.contractualLeaveQuota,
      shiftStartTime: department.shiftStartTime,
      shiftEndTime: department.shiftEndTime,
      workingDays: department.workingDays,
      holidays: department.holidays.map((holiday) => ({
        id: holiday.id,
        name: holiday.name,
        date: holiday.date,
        type: holiday.type,
      })),
      locations: department.locations.map((l) => ({
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
    },
  })
}
