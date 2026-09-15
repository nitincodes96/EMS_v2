import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { generateInviteToken } from "@/lib/invite"
import { getMailBrandName, sendMail } from "@/lib/mail"
import { inviteEmailHtml } from "@/lib/email-templates"
import { logEvent } from "@/lib/system-log"

const MAX_ROWS = 500
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RowInput = {
  email?: unknown
  name?: unknown
  phoneNumber?: unknown
  empCode?: unknown
  department?: unknown
}

type RowResult = {
  email: string
  status: "created" | "skipped" | "failed"
  reason?: string
  departmentName?: string
}

// POST { rows: [...], defaultDepartmentId? }: admin bulk-invites Project
// Assistants from a CSV. Each row becomes the same INVITED account the
// single "Invite User" form creates, with the same invite email. Rows are
// processed one by one so a bad row never blocks the good ones; the response
// says exactly what happened to each.
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as { rows?: RowInput[]; defaultDepartmentId?: string }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 })
    }
    if (body.rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Import at most ${MAX_ROWS} rows at a time` }, { status: 400 })
    }

    const departments = await prisma.department.findMany({ select: { id: true, name: true, slug: true } })
    const byKey = new Map<string, { id: string; name: string }>()
    for (const d of departments) {
      byKey.set(d.name.trim().toLowerCase(), d)
      byKey.set(d.slug.toLowerCase(), d)
    }
    const defaultDept = body.defaultDepartmentId ? departments.find((d) => d.id === body.defaultDepartmentId) : undefined
    if (body.defaultDepartmentId && !defaultDept) {
      return NextResponse.json({ error: "Default department not found" }, { status: 404 })
    }

    const brandName = await getMailBrandName()
    const results: RowResult[] = []
    const seenInBatch = new Set<string>()

    for (const raw of body.rows) {
      const email = String(raw.email ?? "").trim().toLowerCase()
      const name = String(raw.name ?? "").trim()
      const phoneNumber = String(raw.phoneNumber ?? "").trim() || null
      const empCode = String(raw.empCode ?? "").trim() || null
      const deptKey = String(raw.department ?? "").trim().toLowerCase()

      const skip = (reason: string) => results.push({ email: email || "(blank)", status: "skipped", reason })

      if (!email || !EMAIL.test(email)) {
        skip("Invalid email")
        continue
      }
      if (seenInBatch.has(email)) {
        skip("Duplicate email in file")
        continue
      }
      seenInBatch.add(email)

      const department = deptKey ? byKey.get(deptKey) : defaultDept
      if (!department) {
        skip(deptKey ? `Unknown department "${raw.department}"` : "No department (none in file, no default picked)")
        continue
      }

      const [existingEmail, existingEmp] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        empCode ? prisma.user.findUnique({ where: { empCode }, select: { id: true } }) : Promise.resolve(null),
      ])
      if (existingEmail) {
        skip("Email already registered")
        continue
      }
      if (existingEmp) {
        skip(`Employee code "${empCode}" already in use`)
        continue
      }

      try {
        const { token: inviteToken, expiry: inviteTokenExpiry } = generateInviteToken()
        const user = await prisma.user.create({
          data: {
            email,
            empCode,
            name: name || email.split("@")[0],
            password: null,
            role: "PROJECT_ASSISTANT",
            departmentId: department.id,
            isVerified: true,
            status: "INVITED",
            inviteToken,
            inviteTokenExpiry,
            phoneNumber,
          },
        })

        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/login?invite=${inviteToken}`
        try {
          await sendMail({
            to: email,
            subject: `You've been invited to join ${department.name} on ${brandName}`,
            html: inviteEmailHtml({
              name: name || undefined,
              departmentName: department.name,
              inviteLink,
              brandName,
            }),
            fromName: brandName,
          })
        } catch (mailError) {
          // The account exists either way; the admin can resend from the users page.
          console.error(`Invite email failed for ${email}:`, mailError)
        }

        await logEvent({
          category: "USER",
          action: "Project Assistant invited",
          description: `Invited ${user.name || email} as a Project Assistant in ${department.name} (CSV import)`,
          actor: sessionUser,
          entityType: "User",
          entityId: user.id,
          departmentId: department.id,
        })

        results.push({ email, status: "created", departmentName: department.name })
      } catch (error) {
        console.error(`Import failed for ${email}:`, error)
        results.push({ email, status: "failed", reason: "Could not create the account" })
      }
    }

    const created = results.filter((r) => r.status === "created").length
    await logEvent({
      category: "USER",
      action: "PA CSV import",
      description: `Imported ${created} Project Assistant${created === 1 ? "" : "s"} from CSV (${results.length - created} row${results.length - created === 1 ? "" : "s"} skipped)`,
      actor: sessionUser,
      entityType: "User",
    })

    return NextResponse.json({ results, created, total: results.length })
  } catch (error) {
    console.error("Error importing users:", error)
    return NextResponse.json({ error: "Failed to import users" }, { status: 500 })
  }
}
