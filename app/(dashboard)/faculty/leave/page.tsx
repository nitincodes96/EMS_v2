import { LeavePanel } from "@/components/dashboard/leave-panel"
import { LeaveApprovals } from "@/components/dashboard/leave-approvals"

export default function FacultyLeavePage() {
  return (
    <div className="space-y-8">
      <LeaveApprovals title="PA leave requests awaiting your approval" />
      <LeavePanel />
    </div>
  )
}
