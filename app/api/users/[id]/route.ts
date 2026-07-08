import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessOrganization } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "SUPER_ADMIN" && sessionUser.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (target.role === "SUPER_ADMIN" || !target.organizationId || !canAccessOrganization(sessionUser, target.organizationId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const contentType = request.headers.get("content-type") || ""

  try {
    if (contentType.includes("application/json")) {
      const body = await request.json()

      if (typeof body.isActive === "boolean") {
        const updated = await prisma.user.update({ where: { id }, data: { isActive: body.isActive } })
        const { password: _p, ...rest } = updated
        return NextResponse.json({ user: rest })
      }

      if (body.role === "USER" || body.role === "ADMIN") {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            role: body.role,
            userType: body.role === "ADMIN" ? "EMPLOYEE" : target.userType,
          },
        })
        const { password: _p, ...rest } = updated
        return NextResponse.json({ user: rest })
      }

      return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 })
    }

    // multipart/form-data: profile edit
    const formData = await request.formData()

    const emailRaw = formData.get("email") as string | null
    const name = formData.get("name") as string | null
    const roleRaw = formData.get("role") as string | null
    const userTypeRaw = formData.get("userType") as string | null
    const organizationIdRaw = formData.get("organizationId") as string | null
    const phoneNumber = formData.get("phoneNumber") as string | null
    const aadharNumber = formData.get("aadharNumber") as string | null
    const panNumber = formData.get("panNumber") as string | null
    const dateOfBirthRaw = formData.get("dateOfBirth") as string | null
    const basicSalaryRaw = formData.get("basicSalary") as string | null
    const hraRaw = formData.get("hra") as string | null
    const tdsPercentRaw = formData.get("tdsPercent") as string | null
    const pfPercentRaw = formData.get("pfPercent") as string | null
    const lopEnabledRaw = formData.get("lopEnabled") as string | null

    const email = emailRaw?.trim().toLowerCase() ?? null
    const resolvedName = name !== null ? name.trim() : null
    const resolvedOrganizationId = organizationIdRaw !== null ? organizationIdRaw.trim() || target.organizationId || null : target.organizationId

    if (resolvedOrganizationId && !canAccessOrganization(sessionUser, resolvedOrganizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const organization = resolvedOrganizationId
      ? await prisma.organization.findUnique({ where: { id: resolvedOrganizationId } })
      : null

    if (resolvedOrganizationId && !organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    if (email && email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
      }
    }

    let role = roleRaw && roleRaw !== "" ? roleRaw : target.role
    if (role === "SUPER_ADMIN") role = "USER"

    let userType =
      role === "ADMIN"
        ? "EMPLOYEE"
        : userTypeRaw && ["EMPLOYEE", "INTERN", "CONTRACTUAL"].includes(userTypeRaw)
          ? (userTypeRaw as "EMPLOYEE" | "INTERN" | "CONTRACTUAL")
          : target.userType

    const baseLeaveQuota = organization
      ? userType === "INTERN"
        ? organization.internLeaveQuota
        : userType === "CONTRACTUAL"
          ? organization.contractualLeaveQuota
          : organization.employeeLeaveQuota
      : target.baseLeaveQuota

    let photoUrl: string | undefined
    const photo = formData.get("photo") as File | null
    if (photo && photo.size > 0) {
      photoUrl = await saveUploadedFile(photo, "users")
    }

    let resumeUrl: string | undefined
    const resume = formData.get("resume") as File | null
    if (resume && resume.size > 0) {
      resumeUrl = await saveUploadedFile(resume, "resumes")
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(email !== null ? { email } : {}),
        username: (resolvedName || email?.split("@")[0] || target.username).trim(),
        ...(resolvedName !== null ? { name: resolvedName || null } : {}),
        ...(role ? { role: role as "ADMIN" | "USER" } : {}),
        ...(userType ? { userType } : {}),
        ...(organizationIdRaw !== null ? { organizationId: resolvedOrganizationId } : {}),
        ...(phoneNumber !== null ? { phoneNumber } : {}),
        ...(aadharNumber !== null ? { aadharNumber: aadharNumber || null } : {}),
        ...(panNumber !== null ? { panNumber: panNumber || null } : {}),
        ...(dateOfBirthRaw !== null ? { dateOfBirth: dateOfBirthRaw ? new Date(dateOfBirthRaw) : null } : {}),
        ...(basicSalaryRaw !== null ? { basicSalary: basicSalaryRaw ? parseFloat(basicSalaryRaw) : null } : {}),
        ...(hraRaw !== null ? { hra: hraRaw ? parseFloat(hraRaw) : null } : {}),
        ...(tdsPercentRaw !== null ? { tdsPercent: tdsPercentRaw ? parseFloat(tdsPercentRaw) : null } : {}),
        ...(pfPercentRaw !== null ? { pfPercent: pfPercentRaw ? parseFloat(pfPercentRaw) : null } : {}),
        ...(lopEnabledRaw !== null ? { lopEnabled: lopEnabledRaw !== "false" } : {}),
        ...(photoUrl ? { photoUrl } : {}),
        ...(resumeUrl ? { resumeUrl } : {}),
        ...(organization ? { baseLeaveQuota } : {}),
      },
    })

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
