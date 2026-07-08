import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.organizationId) {
    return NextResponse.json({ error: "No organization associated with this account" }, { status: 404 })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: sessionUser.organizationId },
    include: { locations: true },
  })

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  return NextResponse.json({
    organization: {
      name: organization.name,
      shiftStartTime: organization.shiftStartTime,
      shiftEndTime: organization.shiftEndTime,
      workingDays: organization.workingDays,
      locations: organization.locations.map((l) => ({
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
      })),
    },
  })
}
