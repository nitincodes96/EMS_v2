import { format } from "date-fns"
import { CheckCheck } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Read receipt for a booking: shown only once the assigned PA has tapped
 * "Got it" on it. Acknowledging is optional for the PA, so the absence of the
 * badge is deliberately silent — no "not seen yet" nag on either side.
 */
export function PaSeenBadge({
  acknowledgedAt,
  status,
  size = "sm",
  className,
}: {
  acknowledgedAt: string | null
  status: string
  size?: "sm" | "md"
  className?: string
}) {
  if (status !== "BOOKED" || !acknowledgedAt) return null
  return (
    <span
      title={`Acknowledged by the PA on ${format(new Date(acknowledgedAt), "MMM d, yyyy 'at' h:mm a")}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-emerald-50 font-semibold text-emerald-700",
        size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]",
        className
      )}
    >
      <CheckCheck className="h-3 w-3" />
      Seen by PA · {format(new Date(acknowledgedAt), "MMM d, h:mm a")}
    </span>
  )
}
