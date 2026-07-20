import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (target.role === "ADMIN" || !target.departmentId || !canAccessDepartment(sessionUser, target.departmentId)) {
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

      if (body.role === "PROJECT_ASSISTANT" || body.role === "FACULTY") {
        const updated = await prisma.user.update({
          where: { id },
          data: {
            role: body.role,
            userType: body.role === "FACULTY" ? "EMPLOYEE" : target.userType,
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
    const departmentIdRaw = formData.get("departmentId") as string | null
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
    const resolvedDepartmentId = departmentIdRaw !== null ? departmentIdRaw.trim() || target.departmentId || null : target.departmentId

    if (resolvedDepartmentId && !canAccessDepartment(sessionUser, resolvedDepartmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const department = resolvedDepartmentId
      ? await prisma.department.findUnique({ where: { id: resolvedDepartmentId } })
      : null

    if (resolvedDepartmentId && !department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    if (email && email !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
      }
    }

    let role = roleRaw && roleRaw !== "" ? roleRaw : target.role
    if (role === "ADMIN") role = "PROJECT_ASSISTANT"

    let userType =
      role === "FACULTY"
        ? "EMPLOYEE"
        : userTypeRaw && ["EMPLOYEE", "INTERN", "CONTRACTUAL"].includes(userTypeRaw)
          ? (userTypeRaw as "EMPLOYEE" | "INTERN" | "CONTRACTUAL")
          : target.userType

    const baseLeaveQuota = department
      ? userType === "INTERN"
        ? department.internLeaveQuota
        : userType === "CONTRACTUAL"
          ? department.contractualLeaveQuota
          : department.employeeLeaveQuota
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
        ...(role ? { role: role as "FACULTY" | "PROJECT_ASSISTANT" } : {}),
        ...(userType ? { userType } : {}),
        ...(departmentIdRaw !== null ? { departmentId: resolvedDepartmentId } : {}),
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
        ...(department ? { baseLeaveQuota } : {}),
      },
    })

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
