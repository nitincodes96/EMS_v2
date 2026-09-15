import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { generateUniqueOrgSlug } from "@/lib/slug"
import { saveUploadedFile } from "@/lib/upload"
import { logEvent } from "@/lib/system-log"

export async function GET() {
  const sessionUser = await getSessionUser()
  // Moderators work across the organization, so they may read the department list.
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { users: true, leaves: true, attendances: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const adminCounts = await prisma.user.groupBy({
    by: ["departmentId", "role"],
    where: { departmentId: { in: departments.map((o) => o.id) }, role: { in: ["FACULTY", "PROJECT_ASSISTANT"] } },
    _count: { _all: true },
  })

  const result = departments.map((org) => {
    const adminCount = adminCounts.find((c) => c.departmentId === org.id && c.role === "FACULTY")?._count._all ?? 0
    const userCount = adminCounts.find((c) => c.departmentId === org.id && c.role === "PROJECT_ASSISTANT")?._count._all ?? 0
    return { ...org, adminCount, userCount }
  })

  return NextResponse.json({ departments: result })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null
    const organization = await prisma.organization.findFirst()
    if (!organization) {
      return NextResponse.json({ error: "No organization is registered" }, { status: 400 })
    }

    const slug = await generateUniqueOrgSlug(name)

    let logoUrl: string | null = null
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "departments")
    }

    const department = await prisma.department.create({
      data: {
        name,
        slug,
        description,
        logoUrl,
        organizationId: organization.id,
      },
    })

    await logEvent({
      category: "DEPARTMENT",
      action: "Department created",
      description: `Created department "${department.name}"`,
      actor: sessionUser,
      entityType: "Department",
      entityId: department.id,
      departmentId: department.id,
    })

    return NextResponse.json({ department }, { status: 201 })
  } catch (error) {
    console.error("Error creating department:", error)
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 })
  }
}
