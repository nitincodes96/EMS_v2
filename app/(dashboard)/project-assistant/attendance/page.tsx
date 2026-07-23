"use client"

import { format } from "date-fns"
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react"

import { AttendancePanel } from "@/components/dashboard/attendance-panel"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Mock data — daily task attendance is marked by faculty per assigned task.
// Swap for a real API once task-level attendance is tracked in the schema.
// ---------------------------------------------------------------------------

type TaskAttendanceStatus = "PRESENT" | "ABSENT"

type TaskAttendanceRecord = {
  id: string
  date: string
  task: string
  markedBy: string
  status: TaskAttendanceStatus
}

const today = new Date()
const iso = (offsetDays: number) =>
  format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays), "yyyy-MM-dd")

const TASK_ATTENDANCE: TaskAttendanceRecord[] = [
  { id: "ta1", date: iso(0), task: "Frontend Sprint Review", markedBy: "Dr. S. Jenkins", status: "PRESENT" },
  { id: "ta2", date: iso(-1), task: "Q4 Kickoff Meeting", markedBy: "Dr. S. Jenkins", status: "PRESENT" },
  { id: "ta3", date: iso(-2), task: "Client Proposal Draft", markedBy: "Prof. R. Mehta", status: "PRESENT" },
  { id: "ta4", date: iso(-3), task: "Lab Equipment Audit", markedBy: "Prof. A. Iyer", status: "ABSENT" },
  { id: "ta5", date: iso(-4), task: "Infrastructure Sync", markedBy: "Dr. S. Jenkins", status: "PRESENT" },
]

const STATUS_STYLES: Record<TaskAttendanceStatus, string> = {
  PRESENT: "bg-emerald-50 text-emerald-600",
  ABSENT: "bg-red-50 text-red-600",
}

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <AttendancePanel />

      <div>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ClipboardCheck className="h-4.5 w-4.5 text-indigo-600" /> Daily task attendance
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Marked by faculty for tasks you were booked on — separate from your department check-in.
          </p>
        </div>

        <div className="max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Marked by</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {TASK_ATTENDANCE.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    No task attendance recorded yet.
                  </td>
                </tr>
              ) : (
                TASK_ATTENDANCE.map((record) => (
                  <tr key={record.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{format(new Date(record.date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{record.task}</td>
                    <td className="px-4 py-3 text-slate-600">{record.markedBy}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          STATUS_STYLES[record.status]
                        )}
                      >
                        {record.status === "PRESENT" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
