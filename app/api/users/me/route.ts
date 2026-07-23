import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"
import { saveUploadedFile, deleteUploadedFile } from "@/lib/upload"

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      empCode: true,
      phoneNumber: true,
      photoUrl: true,
      role: true,
      isAvailable: true,
      availabilitySince: true,
      joiningDate: true,
      createdAt: true,
      department: { select: { id: true, name: true, logoUrl: true } },
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({ user })
}

export async function PATCH(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const target = await prisma.user.findUnique({ where: { id: sessionUser.id } })
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  try {
    const formData = await request.formData()

    const usernameRaw = formData.get("username") as string | null
    const photo = formData.get("photo") as File | null

    const data: Record<string, unknown> = {}

    if (usernameRaw !== null) {
      const username = usernameRaw.trim()
      if (!username || username.length < 3) {
        return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 })
      }
      data.username = username
    }

    let newPhotoUrl: string | undefined
    if (photo && photo.size > 0) {
      newPhotoUrl = await saveUploadedFile(photo, "users")
      data.photoUrl = newPhotoUrl
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No recognized fields to update" }, { status: 400 })
    }

    const updated = await prisma.user.update({ where: { id: sessionUser.id }, data })

    if (newPhotoUrl && target.photoUrl && target.photoUrl !== newPhotoUrl) {
      await deleteUploadedFile(target.photoUrl)
    }

    const { password: _password, ...userWithoutPassword } = updated
    return NextResponse.json({ user: userWithoutPassword })
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
