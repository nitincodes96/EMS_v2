import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessOrganization } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { generateInviteToken } from "@/lib/invite"
import { sendMail } from "@/lib/mail"
import { inviteEmailHtml } from "@/lib/email-templates"

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "SUPER_ADMIN" && sessionUser.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const organizationIdParam = searchParams.get("organizationId")
  const role = searchParams.get("role")
  const userType = searchParams.get("userType")
  const excludeUserId = searchParams.get("excludeUserId")

  const where: Record<string, unknown> = { role: { not: "SUPER_ADMIN" } }

  if (sessionUser.role === "ADMIN") {
    where.organizationId = sessionUser.organizationId
  } else if (organizationIdParam && organizationIdParam !== "all") {
    where.organizationId = organizationIdParam
  }

  if (role) where.role = role
  if (userType) where.userType = userType
  if (excludeUserId) where.id = { not: excludeUserId }

  const users = await prisma.user.findMany({
    where,
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  })

  const usersWithoutSensitiveFields = users.map(({ password: _password, inviteToken: _inviteToken, otp: _otp, ...rest }) => rest)

  return NextResponse.json({ users: usersWithoutSensitiveFields })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "SUPER_ADMIN" && sessionUser.role !== "ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const formData = await request.formData()

    const email = String(formData.get("email") || "").trim().toLowerCase()
    const name = String(formData.get("name") || "").trim()
    const organizationId = String(formData.get("organizationId") || "")

    if (!email || !organizationId) {
      return NextResponse.json({ error: "Email and organization are required" }, { status: 400 })
    }

    if (!canAccessOrganization(sessionUser, organizationId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
    }

    let role = String(formData.get("role") || "USER")
    if (role === "SUPER_ADMIN") role = "USER"

    let userType = String(formData.get("userType") || "EMPLOYEE") as "EMPLOYEE" | "INTERN" | "CONTRACTUAL"
    if (role === "ADMIN") userType = "EMPLOYEE"

    const phoneNumber = (formData.get("phoneNumber") as string) || null
    const aadharNumber = (formData.get("aadharNumber") as string) || null
    const panNumber = (formData.get("panNumber") as string) || null
    const dateOfBirthRaw = formData.get("dateOfBirth") as string | null
    const dateOfBirth = dateOfBirthRaw ? new Date(dateOfBirthRaw) : null

    const basicSalaryRaw = formData.get("basicSalary") as string | null
    const hraRaw = formData.get("hra") as string | null
    const tdsPercentRaw = formData.get("tdsPercent") as string | null
    const pfPercentRaw = formData.get("pfPercent") as string | null
    const lopEnabled = (formData.get("lopEnabled") as string | null) !== "false"

    const baseLeaveQuota =
      userType === "INTERN"
        ? organization.internLeaveQuota
        : userType === "CONTRACTUAL"
        ? organization.contractualLeaveQuota
        : organization.employeeLeaveQuota

    const username = name || email.split("@")[0]

    let photoUrl: string | null = null
    const photo = formData.get("photo") as File | null
    if (photo && photo.size > 0) {
      photoUrl = await saveUploadedFile(photo, "users")
    }

    let resumeUrl: string | null = null
    const resume = formData.get("resume") as File | null
    if (resume && resume.size > 0) {
      resumeUrl = await saveUploadedFile(resume, "resumes")
    }

    const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()

    const user = await prisma.user.create({
      data: {
        email,
        username,
        name: name || null,
        password: null,
        role: role as "ADMIN" | "USER",
        userType,
        organizationId,
        isVerified: true,
        status: "INVITED",
        inviteToken,
        inviteTokenExpiry,
        phoneNumber,
        aadharNumber,
        panNumber,
        dateOfBirth,
        photoUrl,
        resumeUrl,
        baseLeaveQuota,
        basicSalary: basicSalaryRaw ? parseFloat(basicSalaryRaw) : null,
        hra: hraRaw ? parseFloat(hraRaw) : null,
        tdsPercent: tdsPercentRaw ? parseFloat(tdsPercentRaw) : null,
        pfPercent: pfPercentRaw ? parseFloat(pfPercentRaw) : null,
        lopEnabled,
      },
    })

    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
    try {
      await sendMail({
        to: email,
        subject: `You've been invited to join ${organization.name}`,
        html: inviteEmailHtml({ name: name || undefined, organizationName: organization.name, inviteLink }),
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
