import { NextResponse } from "next/server"
import { endOfDay, formatDuration, intervalToDuration, isAfter, startOfDay } from "date-fns"
import prisma from "@/lib/prisma"
import { getSessionUser } from "@/lib/api-auth"

function formatTime(date: Date | null): string | null {
  if (!date) {
    return null
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || !sessionUser.departmentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()

  const attendance = await prisma.attendance.findFirst({
    where: {
      userId: sessionUser.id,
      date: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
    },
  })

  if (!attendance) {
    return NextResponse.json({ attendance: null })
  }

  const checkedInAt = formatTime(attendance.checkInTime)
  const checkedOutAt = formatTime(attendance.checkOutTime ?? null)
  const ongoing = !attendance.checkOutTime && isAfter(new Date(), attendance.checkInTime)
  const durationSource = attendance.checkOutTime ? attendance.checkOutTime : new Date()
  const duration = formatDuration(intervalToDuration({ start: attendance.checkInTime, end: durationSource }), {
    format: ["hours", "minutes"],
    zero: true,
  })

  return NextResponse.json({
    attendance: {
      id: attendance.id,
      checkedInAt,
      checkedOutAt,
      durationSoFar: duration || "0m",
      isOpen: !attendance.checkOutTime,
      status: attendance.checkOutTime ? "Checked out" : ongoing ? "Checked in" : "Pending",
    },
  })
}