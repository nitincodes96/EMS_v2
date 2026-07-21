import prisma from "@/lib/prisma"
import type { NotificationType } from "@prisma/client"

export async function createNotification(input: {
  userId: string
  type?: NotificationType
  title: string
  message: string
  refId?: string | null
}) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "GENERAL",
      title: input.title,
      message: input.message,
      refId: input.refId ?? null,
    },
  })
}
