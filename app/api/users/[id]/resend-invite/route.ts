import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { generateInviteToken } from "@/lib/invite"
import { getMailBrandName, sendMail } from "@/lib/mail"
import { inviteEmailHtml } from "@/lib/email-templates"
import { logEvent } from "@/lib/system-log"

// Re-issues the invite for a user who hasn't accepted yet (e.g. the first email
// bounced or was lost). A fresh token replaces the old one, so any earlier link
// stops working.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MODERATOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const target = await prisma.user.findUnique({ where: { id }, include: { department: true } })
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Mirrors the invite rules: Moderators may only invite Project Assistants.
  if (sessionUser.role === "MODERATOR" && target.role !== "PROJECT_ASSISTANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (target.status !== "INVITED") {
    return NextResponse.json({ error: "This user has already accepted their invite" }, { status: 400 })
  }
  if (!target.email) {
    return NextResponse.json({ error: "This user has no email address to send an invite to" }, { status: 400 })
  }
  if (!target.isActive) {
    return NextResponse.json({ error: "Reactivate the user before resending their invite" }, { status: 400 })
  }

  const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()
  await prisma.user.update({ where: { id }, data: { inviteToken, inviteTokenExpiry } })

  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
  const brandName = await getMailBrandName()
  const inviteScopeName = target.department?.name || brandName

  try {
    await sendMail({
      to: target.email,
      subject: `You've been invited to join ${inviteScopeName} on ${brandName}`,
      html: inviteEmailHtml({
        name: target.name || undefined,
        departmentName: inviteScopeName,
        inviteLink,
        brandName,
      }),
      fromName: brandName,
    })
  } catch (mailError) {
    console.error("Error resending invite email:", mailError)
    // Surface this one — the whole point of resending is to get the email through.
    return NextResponse.json({ error: "Could not send the invite email. Check SMTP settings and try again." }, { status: 502 })
  }

  await logEvent({
    category: "USER",
    action: "Invite resent",
    description: `Resent invite email to ${target.name || target.email} (${target.email})`,
    actor: sessionUser,
    entityType: "User",
    entityId: target.id,
    departmentId: target.departmentId,
  })

  return NextResponse.json({ ok: true, inviteTokenExpiry })
}
