import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { leaveDecisionEmailHtml } from "@/lib/email-templates"
import { appLink, displayName, mailBrandName, notifyUser } from "@/lib/notify"
import { checkLeaveDecisionAccess, leaveDateLabel, leaveDays } from "@/lib/leave-routing"

// PATCH: approve or reject a leave request.
//
// Who may decide is owned by lib/leave-routing (FR-6.2 / FR-6.3):
//   - Project Assistant leave → Moderator or Admin.
//   - Faculty leave           → Admin only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const leave = await prisma.leave.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      department: { select: { name: true } },
    },
  })
  if (!leave) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 })
  }

  const denied = checkLeaveDecisionAccess(sessionUser, leave)
  if (denied) {
    return NextResponse.json({ error: denied.error }, { status: denied.status })
  }

  try {
    const body = await request.json()
    const { status, remark } = body as { status: string; remark?: string }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // A decided request is final — re-deciding it would silently overwrite the
    // first approver's call and re-notify the requester.
    if (leave.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${leave.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    const trimmedRemark = remark?.trim() || null

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status,
        approverId: sessionUser.id,
        decisionRemark: trimmedRemark,
        decidedAt: new Date(),
      },
    })

    await notifyRequester({ leave, status, remark: trimmedRemark, approverId: sessionUser.id })

    return NextResponse.json({ leave: updated })
  } catch (error) {
    console.error("Error updating leave:", error)
    return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
  }
}

/** Dashboard notification + decision email for whoever applied (FR-6.5). */
async function notifyRequester({
  leave,
  status,
  remark,
  approverId,
}: {
  leave: {
    id: string
    startDate: Date
    endDate: Date
    reason: string | null
    user: { id: string; name: string | null; email: string | null }
    department: { name: string }
  }
  status: "APPROVED" | "REJECTED"
  remark: string | null
  approverId: string
}) {
  const [approver, brandName] = await Promise.all([
    prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true, email: true },
    }),
    mailBrandName(),
  ])

  const dateLabel = leaveDateLabel(leave.startDate, leave.endDate)
  const days = leaveDays(leave.startDate, leave.endDate)
  const decidedByName = approver ? displayName(approver) : "Your moderator"
  const verb = status === "APPROVED" ? "approved" : "rejected"

  await notifyUser({
    userId: leave.user.id,
    type: "LEAVE",
    title: `Leave ${verb}`,
    message: `Your leave for ${dateLabel} was ${verb} by ${decidedByName}${remark ? `: ${remark}` : "."}`,
    refId: leave.id,
    email: {
      to: leave.user.email,
      subject: `Your leave request was ${verb} · ${dateLabel}`,
      html: leaveDecisionEmailHtml({
        brandName,
        requesterName: displayName(leave.user),
        status,
        departmentName: leave.department.name,
        dateLabel,
        days,
        reason: leave.reason,
        decidedByName,
        remark,
        leaveLink: appLink("/project-assistant/leave"),
      }),
    },
  })
}
