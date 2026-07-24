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
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Moderators sit at the organization level with no department, so only an Admin
  // can manage them. Everyone else is gated by department access as usual.
  if (target.role === "MODERATOR") {
    if (sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } else if (!target.departmentId || !canAccessDepartment(sessionUser, target.departmentId)) {
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

      if (body.role === "PROJECT_ASSISTANT" || body.role === "FACULTY" || body.role === "MODERATOR") {
        if (body.role === "FACULTY" && !target.empCode) {
          return NextResponse.json({ error: "Set an employee code before switching this user to Faculty" }, { status: 400 })
        }
        if (body.role === "PROJECT_ASSISTANT" && !target.email) {
          return NextResponse.json({ error: "Set an email before switching this user to Project Assistant" }, { status: 400 })
        }
        // A Moderator decides leave for every department, so only an Admin may appoint one.
        if (body.role === "MODERATOR") {
          if (sessionUser.role !== "ADMIN") {
            return NextResponse.json({ error: "Only an Admin can appoint a Moderator" }, { status: 403 })
          }
          if (!target.email) {
            return NextResponse.json({ error: "Set an email before switching this user to Moderator" }, { status: 400 })
          }
        }
        if (body.role !== "MODERATOR" && !target.departmentId) {
          return NextResponse.json(
            { error: "Assign a department before moving this user out of the Moderator role" },
            { status: 400 }
          )
        }
        const updated = await prisma.user.update({
          where: { id },
          // Promoting to Moderator detaches the user from their department.
          data: { role: body.role, ...(body.role === "MODERATOR" ? { departmentId: null } : {}) },
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

    // The dialog can change the role in the same request, so the fields to read
    // follow the requested role rather than the stored one.
    const roleRaw = formData.get("role") as string | null
    const requestedRole =
      roleRaw === "PROJECT_ASSISTANT" || roleRaw === "FACULTY" || roleRaw === "MODERATOR"
        ? roleRaw
        : null
    if (roleRaw && !requestedRole) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    const effectiveRole = requestedRole ?? target.role

    if (effectiveRole === "FACULTY") {
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

    // Validate the role against the values this same request is setting, not the
    // stored ones — the admin may be filling in the field the new role requires.
    if (requestedRole && requestedRole !== target.role) {
      const nextEmpCode = (data.empCode as string | undefined) ?? target.empCode
      const nextEmail = (data.email as string | null | undefined) ?? target.email

      if (requestedRole === "FACULTY" && !nextEmpCode) {
        return NextResponse.json({ error: "An employee code is required for Faculty" }, { status: 400 })
      }
      if (requestedRole !== "FACULTY" && !nextEmail) {
        return NextResponse.json({ error: "An email is required for this role" }, { status: 400 })
      }
      if (requestedRole === "MODERATOR") {
        if (sessionUser.role !== "ADMIN") {
          return NextResponse.json({ error: "Only an Admin can appoint a Moderator" }, { status: 403 })
        }
        // Moderators belong to the organization, not a department.
        data.departmentId = null
      } else if (!((data.departmentId as string | null | undefined) ?? target.departmentId)) {
        return NextResponse.json(
          { error: "Assign a department before moving this user out of the Moderator role" },
          { status: 400 }
        )
      }

      data.role = requestedRole
    }

    const updated = await prisma.user.update({ where: { id }, data })

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
