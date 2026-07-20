import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"
import { generateInviteToken } from "@/lib/invite"
import { getMailBrandName, sendMail } from "@/lib/mail"
import { inviteEmailHtml } from "@/lib/email-templates"

export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const departmentIdParam = searchParams.get("departmentId")
  const role = searchParams.get("role")
  const userType = searchParams.get("userType")
  const excludeUserId = searchParams.get("excludeUserId")

  const where: Record<string, unknown> = { role: { not: "ADMIN" } }

  if (sessionUser.role === "FACULTY") {
    where.departmentId = sessionUser.departmentId
  } else if (departmentIdParam && departmentIdParam !== "all") {
    where.departmentId = departmentIdParam
  }

  if (role) where.role = role
  if (userType) where.userType = userType
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

    const email = String(formData.get("email") || "").trim().toLowerCase()
    const name = String(formData.get("name") || "").trim()
    const departmentId = String(formData.get("departmentId") || "")

    if (!email || !departmentId) {
      return NextResponse.json({ error: "Email and department are required" }, { status: 400 })
    }

    if (!canAccessDepartment(sessionUser, departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const department = await prisma.department.findUnique({ where: { id: departmentId } })
    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 })
    }

    let role = String(formData.get("role") || "PROJECT_ASSISTANT")
    if (role === "ADMIN") role = "PROJECT_ASSISTANT"

    let userType = String(formData.get("userType") || "EMPLOYEE") as "EMPLOYEE" | "INTERN" | "CONTRACTUAL"
    if (role === "FACULTY") userType = "EMPLOYEE"

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
        ? department.internLeaveQuota
        : userType === "CONTRACTUAL"
        ? department.contractualLeaveQuota
        : department.employeeLeaveQuota

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
        role: role as "FACULTY" | "PROJECT_ASSISTANT",
        userType,
        departmentId,
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
    const brandName = await getMailBrandName()
    try {
      await sendMail({
        to: email,
        subject: `You've been invited to join ${department.name} on ${brandName}`,
        html: inviteEmailHtml({
          name: name || undefined,
          departmentName: department.name,
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
