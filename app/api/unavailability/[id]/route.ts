import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { logEvent } from "@/lib/system-log"
import { noticeDateLabel, noticeWindow, windowBlocksBooking, windowLabel } from "@/lib/unavailability"
import { notifyOfWithdrawal } from "@/lib/unavailability-notify"

const MAX_REMARK = 500

// PATCH { action: "WITHDRAW", remark? }: take back a notice, which reopens the
// slots. The PA who gave it may withdraw it; an admin may revert it on their
// behalf (the PA is told, with the admin's remark). Only while the date
// hasn't passed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const notice = await prisma.unavailabilityNotice.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      department: { select: { name: true } },
    },
  })
  if (!notice) {
    return NextResponse.json({ error: "Notice not found" }, { status: 404 })
  }

  const isAdmin = sessionUser.role === "ADMIN"
  const isOwner = notice.userId === sessionUser.id
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "You can only withdraw your own notices" }, { status: 403 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; remark?: string }
    if (body.action !== "WITHDRAW") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
    }
    if (notice.status === "WITHDRAWN") {
      return NextResponse.json({ error: "This notice was already withdrawn" }, { status: 409 })
    }
    const todayUtc = new Date()
    todayUtc.setUTCHours(0, 0, 0, 0)
    if (notice.date.getTime() < todayUtc.getTime()) {
      return NextResponse.json({ error: "A past notice can't be withdrawn" }, { status: 409 })
    }

    // Only an admin's revert carries a remark — the PA withdrawing their own
    // notice has nobody to explain it to.
    const remark = isAdmin && !isOwner ? (body.remark ?? "").trim().slice(0, MAX_REMARK) || null : null
    const revertedByAdmin = isAdmin && !isOwner

    const updated = await prisma.unavailabilityNotice.update({
      where: { id },
      data: {
        status: "WITHDRAWN",
        withdrawnAt: new Date(),
        withdrawnById: revertedByAdmin ? sessionUser.id : null,
        withdrawRemark: remark,
      },
      include: {
        user: { select: { id: true, name: true, email: true, photoUrl: true } },
        department: { select: { id: true, name: true } },
      },
    })

    // Faculty who were told about the gap get the all-clear
    const window = noticeWindow(updated)
    const dayBookings = await prisma.booking.findMany({
      where: { paId: notice.userId, date: notice.date, status: "BOOKED" },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        task: true,
        workType: true,
        faculty: { select: { id: true, name: true, email: true } },
      },
    })
    const affected = dayBookings.filter((b) => windowBlocksBooking(window, b.startTime, b.endTime))

    const paName = notice.user.name || notice.user.email
    await logEvent({
      category: "UNAVAILABILITY",
      action: revertedByAdmin ? "Unavailability notice reverted by admin" : "Unavailability notice withdrawn",
      description: revertedByAdmin
        ? `An admin reverted ${paName}'s unavailability for ${noticeDateLabel(notice.date)} (${windowLabel(window)})${
            remark ? ` — ${remark}` : ""
          }`
        : `${paName} withdrew their unavailability for ${noticeDateLabel(notice.date)} (${windowLabel(window)})`,
      actor: sessionUser,
      entityType: "UnavailabilityNotice",
      entityId: id,
      departmentId: notice.departmentId,
    })

    await notifyOfWithdrawal({
      notice: updated,
      pa: notice.user,
      departmentName: notice.department.name,
      affected,
      revertedByAdmin,
      remark,
    })

    return NextResponse.json({ notice: updated })
  } catch (error) {
    console.error("Error withdrawing unavailability notice:", error)
    return NextResponse.json({ error: "Failed to withdraw the notice" }, { status: 500 })
  }
}
