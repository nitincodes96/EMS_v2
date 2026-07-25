import type { NotificationType } from "@prisma/client"

import { createNotification } from "@/lib/notifications"
import { getMailBrandName, sendMail } from "@/lib/mail"

/**
 * Fan-out helper for "tell the user about this" events: writes the in-app
 * notification that feeds the dashboard bell and sends the matching email.
 *
 * Neither channel is allowed to fail the request that triggered it — a dead
 * SMTP host must not roll back a booking or a leave decision — so both are
 * caught and logged. The return value says what actually went out.
 */
export async function notifyUser(input: {
  userId: string
  type?: NotificationType
  title: string
  message: string
  refId?: string | null
  email?: {
    to?: string | null
    subject: string
    html: string
  }
}): Promise<{ notified: boolean; emailed: boolean }> {
  const [notification, mail] = await Promise.allSettled([
    createNotification({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      refId: input.refId ?? null,
    }),
    input.email?.to
      ? sendMail({ to: input.email.to, subject: input.email.subject, html: input.email.html })
      : Promise.resolve(null),
  ])

  if (notification.status === "rejected") {
    console.error("Failed to create notification:", notification.reason)
  }
  if (mail.status === "rejected") {
    console.error("Failed to send notification email:", mail.reason)
  }

  return {
    notified: notification.status === "fulfilled",
    emailed: mail.status === "fulfilled" && Boolean(input.email?.to),
  }
}

/** Notify several recipients in parallel; never throws. */
export async function notifyUsers(inputs: Parameters<typeof notifyUser>[0][]) {
  return Promise.all(inputs.map((input) => notifyUser(input)))
}

/** Absolute base URL used to build deep links inside emails. */
export function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || ""
  return raw.replace(/\/+$/, "")
}

/** Absolute portal link, or undefined when no base URL is configured. */
export function appLink(path: string): string | undefined {
  const base = appBaseUrl()
  if (!base) return undefined
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

/** Brand name for the mail "from" header and email body, with a safe fallback. */
export async function mailBrandName(): Promise<string> {
  try {
    return await getMailBrandName()
  } catch {
    return "EMS Portal"
  }
}

/** Display name for a user record, falling back through username then email. */
export function displayName(user: {
  name?: string | null
  username?: string | null
  email?: string | null
}): string {
  return user.name?.trim() || user.username?.trim() || user.email?.trim() || "there"
}
