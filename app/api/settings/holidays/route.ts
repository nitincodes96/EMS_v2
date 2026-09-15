import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { logEvent } from "@/lib/system-log"

const VALID_TYPES = ["NATIONAL", "RELIGIOUS", "CUSTOM"] as const
type HolidayType = (typeof VALID_TYPES)[number]

function parseHoliday(raw: { name?: unknown; date?: unknown; type?: unknown }) {
  const name = typeof raw.name === "string" ? raw.name.trim() : ""
  const dateStr = typeof raw.date === "string" ? raw.date : ""
  const type = String(raw.type ?? "").toUpperCase() as HolidayType
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !VALID_TYPES.includes(type)) return null
  const date = new Date(`${dateStr}T00:00:00.000Z`)
  if (isNaN(date.getTime())) return null
  return { name, date, type }
}

// GET: the organization-wide holiday calendar, soonest first. Any signed-in user.
export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } })
  return NextResponse.json({ holidays })
}

// POST: admin adds one holiday `{ name, date, type }` or several at once
// `{ holidays: [...] }` (CSV import, the religious-holiday picker). Rows that
// duplicate an existing name+date are skipped rather than failing the batch.
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as
      | { name?: unknown; date?: unknown; type?: unknown }
      | { holidays?: { name?: unknown; date?: unknown; type?: unknown }[] }

    if ("holidays" in body && Array.isArray(body.holidays)) {
      const rows = body.holidays.map(parseHoliday)
      if (rows.some((r) => r === null)) {
        return NextResponse.json({ error: "One or more holidays are invalid" }, { status: 400 })
      }
      const data = rows as NonNullable<(typeof rows)[number]>[]
      const { count } = await prisma.holiday.createMany({ data, skipDuplicates: true })

      await logEvent({
        category: "DEPARTMENT",
        action: "Holidays imported",
        description: `Added ${count} holiday${count === 1 ? "" : "s"} (${data.length - count} already existed)`,
        actor: sessionUser,
        entityType: "Holiday",
      })

      const holidays = await prisma.holiday.findMany({ orderBy: { date: "asc" } })
      return NextResponse.json({ holidays, added: count }, { status: 201 })
    }

    const parsed = parseHoliday(body as { name?: unknown; date?: unknown; type?: unknown })
    if (!parsed) {
      return NextResponse.json({ error: "Invalid holiday data" }, { status: 400 })
    }

    const holiday = await prisma.holiday.create({ data: parsed })

    await logEvent({
      category: "DEPARTMENT",
      action: "Holiday added",
      description: `Added ${parsed.type.toLowerCase()} holiday "${holiday.name}" on ${holiday.date.toISOString().slice(0, 10)}`,
      actor: sessionUser,
      entityType: "Holiday",
      entityId: holiday.id,
    })

    return NextResponse.json({ holiday }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That holiday already exists on that date" }, { status: 409 })
    }
    console.error("Error creating holiday:", error)
    return NextResponse.json({ error: "Failed to create holiday" }, { status: 500 })
  }
}
