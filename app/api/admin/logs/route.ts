import { NextResponse } from "next/server"
import { Prisma, type SystemLogCategory } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

const CATEGORIES: SystemLogCategory[] = ["AUTH", "USER", "DEPARTMENT", "BOOKING", "LEAVE"]

function isCategory(value: string | null): value is SystemLogCategory {
  return value != null && (CATEGORIES as string[]).includes(value)
}

// GET: the site-wide audit trail behind the admin System Logs page.
// Admin only — this exposes activity across every department at once.
export async function GET(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get("category")
  const departmentId = searchParams.get("departmentId")
  const q = (searchParams.get("q") ?? "").trim()
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  )
  const requestedPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)

  // "to" is an inclusive calendar day, so the range runs to the start of the
  // following day rather than to midnight of the day itself.
  const createdAt: Prisma.DateTimeFilter = {}
  if (from) createdAt.gte = new Date(`${from}T00:00:00.000`)
  if (to) {
    const end = new Date(`${to}T00:00:00.000`)
    end.setDate(end.getDate() + 1)
    createdAt.lt = end
  }

  const where: Prisma.SystemLogWhereInput = {
    ...(isCategory(category) ? { category } : {}),
    ...(departmentId && departmentId !== "all" ? { departmentId } : {}),
    ...(from || to ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q } },
            { description: { contains: q } },
            { actorLabel: { contains: q } },
          ],
        }
      : {}),
  }

  const total = await prisma.systemLog.count({ where })
  const totalPages = Math.max(1, Math.ceil(total / limit))
  // Clamp so a shrinking result set can't strand the client on an empty page
  const page = Math.min(requestedPage, totalPages)

  const [logs, categoryCounts] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { id: true, name: true, email: true, photoUrl: true } } },
    }),
    // Counts ignore the category filter itself so every pill keeps its total
    prisma.systemLog.groupBy({
      by: ["category"],
      where: { ...where, category: undefined },
      _count: { _all: true },
    }),
  ])

  // Department names are resolved in one pass rather than via a relation, since
  // SystemLog.departmentId is a loose pointer that outlives the department.
  const departmentIds = [...new Set(logs.map((l) => l.departmentId).filter((v): v is string => Boolean(v)))]
  const departments = departmentIds.length
    ? await prisma.department.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true },
      })
    : []
  const departmentNameById = new Map(departments.map((d) => [d.id, d.name]))

  return NextResponse.json({
    logs: logs.map((log) => ({
      ...log,
      departmentName: log.departmentId ? (departmentNameById.get(log.departmentId) ?? null) : null,
    })),
    pagination: { page, limit, total, totalPages },
    counts: Object.fromEntries(categoryCounts.map((c) => [c.category, c._count._all])),
  })
}
