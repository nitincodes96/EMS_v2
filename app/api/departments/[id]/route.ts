import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { logEvent } from "@/lib/system-log"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.department.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null

    let logoUrl: string | undefined
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "departments")
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name,
        description,
        ...(logoUrl ? { logoUrl } : {}),
      },
    })

    await logEvent({
      category: "DEPARTMENT",
      action: "Department updated",
      description: describeDepartmentChanges(existing, { name }),
      actor: sessionUser,
      entityType: "Department",
      entityId: id,
      departmentId: id,
    })

    return NextResponse.json({ department })
  } catch (error) {
    console.error("Error updating department:", error)
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 })
  }
}

/**
 * Names what changed, so the audit trail reads "renamed to X" rather than
 * just "updated". Falls back to a plain notice when only untracked fields
 * (logo, description) moved.
 */
function describeDepartmentChanges(before: { name: string }, after: { name: string }): string {
  return before.name !== after.name
    ? `Updated "${after.name}": renamed from "${before.name}"`
    : `Updated "${after.name}" settings`
}
