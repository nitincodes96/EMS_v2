import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { createNotification } from "@/lib/notifications"

// PATCH: update booking status (mark ABSENT / COMPLETED / CANCELLED) — FR-4.6
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Only the booking's faculty or an admin may change it
  const isOwnerFaculty = sessionUser.role === "FACULTY" && booking.facultyId === sessionUser.id
  if (sessionUser.role !== "ADMIN" && !isOwnerFaculty) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const status = body.status as "COMPLETED" | "ABSENT" | "CANCELLED"
    if (!["COMPLETED", "ABSENT", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const updated = await prisma.booking.update({ where: { id }, data: { status } })

    if (status === "ABSENT") {
      await createNotification({
        userId: booking.paId,
        type: "BOOKING",
        title: "Marked absent",
        message: "You were marked absent for a booked slot.",
        refId: booking.id,
      })
    }

    return NextResponse.json({ booking: updated })
  } catch (error) {
    console.error("Error updating booking:", error)
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 })
  }
}
