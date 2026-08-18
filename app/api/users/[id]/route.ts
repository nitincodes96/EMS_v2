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

      // A user's role is fixed once the account exists — it decides which
      // department scoping, approval routing and dashboards apply to them, so
      // changing it underneath live bookings/leave would silently rewrite who
      // owns that history. Delete and re-invite instead.
      if (typeof body.role === "string") {
        return NextResponse.json({ error: "A user's role can't be changed after the account is created" }, { status: 400 })
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

    // The role is immutable after creation (see the JSON branch above), so the
    // fields to read always follow the stored role. The dialog still posts the
    // field, but a value that differs from the stored one is rejected outright
    // rather than silently ignored.
    const roleRaw = formData.get("role") as string | null
    if (roleRaw && roleRaw !== target.role) {
      return NextResponse.json({ error: "A user's role can't be changed after the account is created" }, { status: 400 })
    }
    const effectiveRole = target.role

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
      }
      if (resolvedName !== null) {
        const effectiveEmpCode = (data.empCode as string | undefined) ?? target.empCode
        data.name = resolvedName || effectiveEmpCode || null
      }
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
        const effectiveEmail = email ?? target.email
        data.name = resolvedName || effectiveEmail?.split("@")[0] || null
      }
      if (phoneNumber !== null) data.phoneNumber = phoneNumber
    }

    // A PA with an open booking in their current department can't be silently
    // moved out of it — the faculty who booked them, and the department's own
    // rosters/dashboards, all still expect them there until it's closed out.
    if (target.role === "PROJECT_ASSISTANT" && target.departmentId) {
      const finalDepartmentId = "departmentId" in data ? (data.departmentId as string | null) : target.departmentId
      if (finalDepartmentId !== target.departmentId) {
        const activeBookingCount = await prisma.booking.count({
          where: { paId: target.id, departmentId: target.departmentId, status: "BOOKED" },
        })
        if (activeBookingCount > 0) {
          return NextResponse.json(
            {
              error: `This PA has ${activeBookingCount} active booking${activeBookingCount > 1 ? "s" : ""} in their current department. Complete or cancel ${activeBookingCount > 1 ? "them" : "it"} before changing their department.`,
              // Lets the client deep-link straight to the blocking bookings.
              blockedBookings: { departmentId: target.departmentId, paId: target.id },
            },
            { status: 409 }
          )
        }
      }
    }

    const updated = await prisma.user.update({ where: { id }, data })

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }
}
