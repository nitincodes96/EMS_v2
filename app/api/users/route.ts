import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { generateInviteToken } from "@/lib/invite"
import { getMailBrandName, sendMail } from "@/lib/mail"
import { inviteEmailHtml } from "@/lib/email-templates"

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  // Faculty, PAs and Moderators get read-only access, scoped below.
  if (
    !sessionUser ||
    (sessionUser.role !== "ADMIN" &&
      sessionUser.role !== "FACULTY" &&
      sessionUser.role !== "PROJECT_ASSISTANT" &&
      sessionUser.role !== "MODERATOR")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")
  const role = searchParams.get("role")
  const excludeUserId = searchParams.get("excludeUserId")

  const where: Record<string, unknown> = { role: { not: "ADMIN" } }

  if (sessionUser.role === "FACULTY" || sessionUser.role === "PROJECT_ASSISTANT") {
    // Their own department only — Faculty and PAs see each other. The fallback
    // matches nothing, since a null departmentId would otherwise match every
    // department-less user (i.e. the Moderators).
    where.departmentId = sessionUser.departmentId ?? "__none__"
  } else if (sessionUser.role === "MODERATOR") {
    // Organization-wide: every user in the org, optionally narrowed to one department.
    if (departmentIdParam && departmentIdParam !== "all") {
      where.departmentId = departmentIdParam
    }
  } else if (departmentIdParam && departmentIdParam !== "all") {
    where.departmentId = departmentIdParam
  }

  if (role) where.role = role
  if (excludeUserId) where.id = { not: excludeUserId }

  const users = await prisma.user.findMany({
    where,
    include: { department: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const usersWithoutSensitiveFields = users.map(({ password: _password, inviteToken: _inviteToken, otp: _otp, ...rest }) => rest)

  return NextResponse.json({ users: usersWithoutSensitiveFields })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    let role = String(formData.get("role") || "PROJECT_ASSISTANT")
    if (role === "ADMIN") role = "PROJECT_ASSISTANT"
    // A Moderator decides leave for every department, so only an Admin may appoint one.
    if (role === "MODERATOR" && sessionUser.role !== "ADMIN") role = "PROJECT_ASSISTANT"

    const name = String(formData.get("name") || "").trim()
    const departmentId = String(formData.get("departmentId") || "")
    // Moderators belong to the organization, so they are created without a department.
    const isModerator = role === "MODERATOR"

    if (!departmentId && !isModerator) {
      return NextResponse.json({ error: "Department is required" }, { status: 400 })
    }

    if (departmentId && !canAccessDepartment(sessionUser, departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const department = isModerator
      ? null
      : await prisma.department.findUnique({ where: { id: departmentId } })
    if (!isModerator && !department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    let photoUrl: string | null = null
    const photo = formData.get("photo") as File | null
    if (photo && photo.size > 0) {
      photoUrl = await saveUploadedFile(photo, "users")
    }

    if (role === "FACULTY") {
      const empCode = String(formData.get("empCode") || "").trim()
      if (!empCode) {
        return NextResponse.json({ error: "Employee code is required" }, { status: 400 })
      }

      const existingEmpCode = await prisma.user.findUnique({ where: { empCode } })
      if (existingEmpCode) {
        return NextResponse.json({ error: "A user with this employee code already exists" }, { status: 400 })
      }

      const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()

      const user = await prisma.user.create({
        data: {
          empCode,
          username: empCode,
          name: name || null,
          password: null,
          role: "FACULTY",
          departmentId,
          isVerified: true,
          status: "INVITED",
          inviteToken,
          inviteTokenExpiry,
          photoUrl,
        },
      })

      const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
      const { password: _password, inviteToken: _inviteToken, otp: _otp, ...userWithoutSensitiveFields } = user
      return NextResponse.json({ user: userWithoutSensitiveFields, inviteLink }, { status: 201 })
    }

    const email = String(formData.get("email") || "").trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
    }

    const phoneNumber = (formData.get("phoneNumber") as string) || null
    const username = name || email.split("@")[0]

    const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: name || null,
        password: null,
        role: isModerator ? "MODERATOR" : "PROJECT_ASSISTANT",
        departmentId: isModerator ? null : departmentId,
        isVerified: true,
        status: "INVITED",
        inviteToken,
        inviteTokenExpiry,
        phoneNumber,
        photoUrl,
      },
    })

    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
    const brandName = await getMailBrandName()
    // Moderators have no department, so the invite is issued in the org's name.
    const inviteScopeName = department?.name || brandName
    try {
      await sendMail({
        to: email,
        subject: `You've been invited to join ${inviteScopeName} on ${brandName}`,
        html: inviteEmailHtml({
          name: name || undefined,
          departmentName: inviteScopeName,
          inviteLink,
          brandName,
        }),
        fromName: brandName,
      })
    } catch (mailError) {
      console.error("Error sending invite email:", mailError)
    }

    const { password: _password, inviteToken: _inviteToken, otp: _otp, ...userWithoutSensitiveFields } = user
    return NextResponse.json({ user: userWithoutSensitiveFields }, { status: 201 })
  } catch (error) {
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
