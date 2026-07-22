import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { generateInviteToken } from "@/lib/invite"

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
        if (body.role === "FACULTY" && !target.empCode) {
          return NextResponse.json({ error: "Set an employee code before switching this user to Faculty" }, { status: 400 })
        }
        if (body.role === "PROJECT_ASSISTANT" && !target.email) {
          return NextResponse.json({ error: "Set an email before switching this user to Project Assistant" }, { status: 400 })
        }
        const updated = await prisma.user.update({
          where: { id },
          data: { role: body.role },
        })
        const { password: _p, ...rest } = updated
        return NextResponse.json({ user: rest })
      }

      if (body.regenerateInvite === true) {
        const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()
        const updated = await prisma.user.update({
          where: { id },
          data: { password: null, status: "INVITED", inviteToken, inviteTokenExpiry },
        })
        const { password: _p, ...rest } = updated
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
        return NextResponse.json({ user: rest, inviteLink })
      }

      return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 })
    }

    // multipart/form-data: profile edit
    const formData = await request.formData()

    const name = formData.get("name") as string | null
    const departmentIdRaw = formData.get("departmentId") as string | null
    const resolvedName = name !== null ? name.trim() : null
    const resolvedDepartmentId = departmentIdRaw !== null ? departmentIdRaw.trim() || target.departmentId || null : target.departmentId

    if (resolvedDepartmentId && !canAccessDepartment(sessionUser, resolvedDepartmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (resolvedDepartmentId) {
      const department = await prisma.department.findUnique({ where: { id: resolvedDepartmentId } })
      if (!department) {
        return NextResponse.json({ error: "Department not found" }, { status: 404 })
      }
    }

    let photoUrl: string | undefined
    const photo = formData.get("photo") as File | null
    if (photo && photo.size > 0) {
      photoUrl = await saveUploadedFile(photo, "users")
    }

    const data: Record<string, unknown> = {
      ...(departmentIdRaw !== null ? { departmentId: resolvedDepartmentId } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    }

    if (target.role === "FACULTY") {
      const empCodeRaw = formData.get("empCode") as string | null
      if (empCodeRaw !== null) {
        const empCode = empCodeRaw.trim()
        if (!empCode) {
          return NextResponse.json({ error: "Employee code is required" }, { status: 400 })
        }
        if (empCode !== target.empCode) {
          const existing = await prisma.user.findUnique({ where: { empCode } })
          if (existing && existing.id !== id) {
            return NextResponse.json({ error: "A user with this employee code already exists" }, { status: 400 })
          }
        }
        data.empCode = empCode
        data.username = empCode
      }
      if (resolvedName !== null) data.name = resolvedName || null
    } else {
      const emailRaw = formData.get("email") as string | null
      const phoneNumber = formData.get("phoneNumber") as string | null
      const email = emailRaw?.trim().toLowerCase() ?? null

      if (email && email !== target.email) {
        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
        }
      }

      if (email !== null) data.email = email
      if (resolvedName !== null) {
        data.name = resolvedName || null
        data.username = (resolvedName || email?.split("@")[0] || target.username).trim()
      }
      if (phoneNumber !== null) data.phoneNumber = phoneNumber
    }

    const updated = await prisma.user.update({ where: { id }, data })

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
