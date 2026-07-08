import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { generateUniqueOrgSlug } from "@/lib/slug"
import { saveUploadedFile } from "@/lib/upload"

type LocationInput = { name: string; latitude: number; longitude: number; radiusMeters: number }
type HolidayInput = { name: string; date: string; type: "CUSTOM" | "RELIGIOUS" | "NATIONAL" }

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const organizations = await prisma.organization.findMany({
    include: {
      locations: true,
      _count: { select: { users: true, leaves: true, attendances: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const adminCounts = await prisma.user.groupBy({
    by: ["organizationId", "role"],
    where: { organizationId: { in: organizations.map((o) => o.id) }, role: { in: ["ADMIN", "USER"] } },
    _count: { _all: true },
  })

  const result = organizations.map((org) => {
    const adminCount = adminCounts.find((c) => c.organizationId === org.id && c.role === "ADMIN")?._count._all ?? 0
    const userCount = adminCounts.find((c) => c.organizationId === org.id && c.role === "USER")?._count._all ?? 0
    return { ...org, adminCount, userCount }
  })

  return NextResponse.json({ organizations: result })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null
    const workingDays = (formData.get("workingDays") as string) || "Mon,Tue,Wed,Thu,Fri"
    const shiftStartTime = (formData.get("shiftStartTime") as string) || "09:00"
    const shiftEndTime = (formData.get("shiftEndTime") as string) || "18:00"
    const lateGraceMinutes = parseInt((formData.get("lateGraceMinutes") as string) || "5", 10)
    const employeeLeaveQuota = parseInt((formData.get("employeeLeaveQuota") as string) || "20", 10)
    const internLeaveQuota = parseInt((formData.get("internLeaveQuota") as string) || "20", 10)
    const contractualLeaveQuota = parseInt((formData.get("contractualLeaveQuota") as string) || "20", 10)
    const employeeMonthlyCap = parseInt((formData.get("employeeMonthlyCap") as string) || "5", 10)
    const internMonthlyCap = parseInt((formData.get("internMonthlyCap") as string) || "3", 10)
    const contractualMonthlyCap = parseInt((formData.get("contractualMonthlyCap") as string) || "4", 10)

    let locations: LocationInput[] = []
    const locationsRaw = formData.get("locations") as string | null
    if (locationsRaw) {
      try {
        locations = JSON.parse(locationsRaw)
      } catch {
        return NextResponse.json({ error: "Invalid locations payload" }, { status: 400 })
      }
    }

    let holidays: HolidayInput[] = []
    const holidaysRaw = formData.get("holidays") as string | null
    if (holidaysRaw) {
      try {
        holidays = JSON.parse(holidaysRaw)
      } catch {
        return NextResponse.json({ error: "Invalid holidays payload" }, { status: 400 })
      }
    }

    const platform = await prisma.platform.findFirst()
    if (!platform) {
      return NextResponse.json({ error: "No platform is registered" }, { status: 400 })
    }

    const slug = await generateUniqueOrgSlug(name)

    let logoUrl: string | null = null
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "organizations")
    }

    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        description,
        logoUrl,
        platformId: platform.id,
        workingDays,
        shiftStartTime,
        shiftEndTime,
        lateGraceMinutes,
        employeeLeaveQuota,
        internLeaveQuota,
        contractualLeaveQuota,
        employeeMonthlyCap,
        internMonthlyCap,
        contractualMonthlyCap,
        locations: {
          createMany: {
            data: locations.map((l) => ({
              name: l.name,
              latitude: Number(l.latitude),
              longitude: Number(l.longitude),
              radiusMeters: Number(l.radiusMeters) || 100,
            })),
          },
        },
        holidays: {
          createMany: {
            data: holidays.map((h) => ({
              name: h.name,
              date: new Date(h.date),
              type: h.type,
            })),
          },
        },
      },
      include: { locations: true },
    })

    return NextResponse.json({ organization }, { status: 201 })
  } catch (error) {
    console.error("Error creating organization:", error)
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
