import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import {
  SCHEDULE_SETTINGS_ID,
  describeScheduleChanges,
  getScheduleSettings,
  parseScheduleSettings,
} from "@/lib/schedule-settings"
import { logEvent } from "@/lib/system-log"

// GET: the organization-wide schedule / booking rules. Any signed-in user may
// read them — the calendars and dashboards of every role depend on them.
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await getScheduleSettings()
  return NextResponse.json({ settings })
}

// PUT: admin-only update. Accepts the full settings object as JSON; any field
// left out keeps its current value.
export async function PUT(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const current = await getScheduleSettings()

    const parsed = parseScheduleSettings(body, current)
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const settings = await prisma.scheduleSettings.update({
      where: { id: SCHEDULE_SETTINGS_ID },
      data: parsed.value,
    })

    await logEvent({
      category: "DEPARTMENT",
      action: "Schedule settings updated",
      description: describeScheduleChanges(current, parsed.value),
      actor: sessionUser,
      entityType: "ScheduleSettings",
      entityId: SCHEDULE_SETTINGS_ID,
    })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error updating schedule settings:", error)
    return NextResponse.json({ error: "Failed to update schedule settings" }, { status: 500 })
  }
}
