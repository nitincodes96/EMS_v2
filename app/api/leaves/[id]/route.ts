import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser, canAccessDepartment } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (
    !sessionUser ||
    (sessionUser.role !== "ADMIN" && sessionUser.role !== "FACULTY" && sessionUser.role !== "MODERATOR")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const leave = await prisma.leave.findUnique({
    where: { id },
    include: { user: { select: { id: true, role: true } } },
  })
  if (!leave) {
    return NextResponse.json({ error: "Leave not found" }, { status: 404 })
  }

  // Routing rules (FR-6.2 / FR-6.3):
  //  - Faculty leave requests can be approved ONLY by an Admin.
  //  - PA leave requests can be approved by a Faculty member (own department),
  //    a Moderator (any department) or an Admin.
  if (sessionUser.role === "MODERATOR") {
    if (leave.user.role !== "PROJECT_ASSISTANT") {
      return NextResponse.json(
        { error: "Moderators can only decide Project Assistant leave requests" },
        { status: 403 }
      )
    }
  } else {
    if (!canAccessDepartment(sessionUser, leave.departmentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (leave.user.role === "FACULTY" && sessionUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Only an Admin can decide Faculty leave requests" }, { status: 403 })
    }
    if (leave.user.role === "ADMIN") {
      return NextResponse.json({ error: "Admin leave requests are not managed here" }, { status: 403 })
    }
  }

  try {
    const body = await request.json()
    const { status, remark } = body as { status: string; remark?: string }

    if (status !== "APPROVED" && status !== "REJECTED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status,
        approverId: sessionUser.id,
        decisionRemark: remark?.trim() || null,
        decidedAt: new Date(),
      },
    })

    // Notify requester (FR-6.5)
    await createNotification({
      userId: leave.userId,
      type: "LEAVE",
      title: `Leave ${status === "APPROVED" ? "approved" : "rejected"}`,
      message: `Your leave request was ${status.toLowerCase()}${remark?.trim() ? `: ${remark.trim()}` : "."}`,
      refId: leave.id,
    })

    return NextResponse.json({ leave: updated })
  } catch (error) {
    console.error("Error updating leave:", error)
    return NextResponse.json({ error: "Failed to update leave" }, { status: 500 })
  }
}
