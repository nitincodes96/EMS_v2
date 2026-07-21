import { LeaveApprovals } from "@/components/dashboard/leave-approvals"

export default function AdminLeavePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leave</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and decide leave requests from Faculty and Project Assistants.
        </p>
      </div>
      <LeaveApprovals title="All pending leave requests" />
    </div>
  )
}
