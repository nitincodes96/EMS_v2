import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { saveUploadedFile } from "@/lib/upload"

type LocationInput = { name: string; latitude: number; longitude: number; radiusMeters: number }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const existing = await prisma.organization.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const formData = await request.formData()

    const name = String(formData.get("name") || "").trim()
    if (!name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 })
    }

    const description = (formData.get("description") as string) || null
    const workingDays = (formData.get("workingDays") as string) || existing.workingDays
    const shiftStartTime = (formData.get("shiftStartTime") as string) || existing.shiftStartTime
    const shiftEndTime = (formData.get("shiftEndTime") as string) || existing.shiftEndTime
    const lateGraceMinutes = parseInt((formData.get("lateGraceMinutes") as string) || String(existing.lateGraceMinutes), 10)
    const employeeLeaveQuota = parseInt((formData.get("employeeLeaveQuota") as string) || String(existing.employeeLeaveQuota), 10)
    const internLeaveQuota = parseInt((formData.get("internLeaveQuota") as string) || String(existing.internLeaveQuota), 10)
    const contractualLeaveQuota = parseInt((formData.get("contractualLeaveQuota") as string) || String(existing.contractualLeaveQuota), 10)
    const employeeMonthlyCap = parseInt((formData.get("employeeMonthlyCap") as string) || String(existing.employeeMonthlyCap), 10)
    const internMonthlyCap = parseInt((formData.get("internMonthlyCap") as string) || String(existing.internMonthlyCap), 10)
    const contractualMonthlyCap = parseInt((formData.get("contractualMonthlyCap") as string) || String(existing.contractualMonthlyCap), 10)

    let locations: LocationInput[] | null = null
    const locationsRaw = formData.get("locations") as string | null
    if (locationsRaw) {
      try {
        locations = JSON.parse(locationsRaw)
      } catch {
        return NextResponse.json({ error: "Invalid locations payload" }, { status: 400 })
      }
    }

    let logoUrl: string | undefined
    const logo = formData.get("logo") as File | null
    if (logo && logo.size > 0) {
      logoUrl = await saveUploadedFile(logo, "organizations")
    }

    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id },
        data: {
          name,
          description,
          workingDays,
          shiftStartTime,
          shiftEndTime,
          lateGraceMinutes,
          employeeLeaveQuota,
          internLeaveQuota,
          contractualLeaveQuota,
          employeeMonthlyCap,
          internMonthlyCap,
          contractualMonthlyCap,
          ...(logoUrl ? { logoUrl } : {}),
        },
      })

      if (locations) {
        await tx.organizationLocation.deleteMany({ where: { organizationId: id } })
        if (locations.length > 0) {
          await tx.organizationLocation.createMany({
            data: locations.map((l) => ({
              organizationId: id,
              name: l.name,
              latitude: Number(l.latitude),
              longitude: Number(l.longitude),
              radiusMeters: Number(l.radiusMeters) || 100,
            })),
          })
        }
      }
    })

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { locations: true },
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error("Error updating organization:", error)
    return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
  }
}
