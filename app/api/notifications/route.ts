import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

// GET: current user's notifications (most recent first) + unread count
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: sessionUser.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: sessionUser.id, isRead: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

// PATCH: mark all as read
export async function PATCH() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.notification.updateMany({
    where: { userId: sessionUser.id, isRead: false },
    data: { isRead: true },
  })

  return NextResponse.json({ ok: true })
}
