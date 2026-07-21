"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { CalendarPlus, ClipboardList, Inbox, UserCheck } from "lucide-react"
import { useSession } from "next-auth/react"

import { cn } from "@/lib/utils"

export default function FacultyDashboard() {
  const { data: session } = useSession()
  const [availablePAs, setAvailablePAs] = useState(0)
  const [activeBookings, setActiveBookings] = useState(0)
  const [pendingLeaves, setPendingLeaves] = useState(0)

  useEffect(() => {
    fetch("/api/availability").then((r) => r.json()).then((d) => setAvailablePAs((d.pas ?? []).length)).catch(() => {})
    fetch("/api/bookings").then((r) => r.json()).then((d) =>
      setActiveBookings((d.bookings ?? []).filter((b: { status: string }) => b.status === "BOOKED").length)
    ).catch(() => {})
    fetch("/api/leaves/pending").then((r) => r.json()).then((d) => setPendingLeaves((d.leaves ?? []).length)).catch(() => {})
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Welcome, {session?.user?.name ?? "Faculty"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<UserCheck className="h-5 w-5" />} label="Available PAs" value={availablePAs} accent="bg-emerald-50 text-emerald-600" />
        <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Active bookings" value={activeBookings} accent="bg-indigo-50 text-indigo-600" />
        <StatCard icon={<Inbox className="h-5 w-5" />} label="Leave requests" value={pendingLeaves} accent="bg-amber-50 text-amber-600" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickLink href="/faculty/book-pa" icon={<CalendarPlus className="h-5 w-5" />} title="Book a PA" desc="Assign a task to an available PA" />
        <QuickLink href="/faculty/bookings" icon={<ClipboardList className="h-5 w-5" />} title="My bookings" desc="Track slots & mark absences" />
        <QuickLink href="/faculty/leave" icon={<Inbox className="h-5 w-5" />} title="Leave" desc="Apply & approve PA leaves" />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", accent)}>{icon}</span>
      <p className="mt-4 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{icon}</span>
      <p className="mt-4 text-sm font-semibold text-slate-900 group-hover:text-indigo-600">{title}</p>
      <p className="text-xs text-slate-500">{desc}</p>
    </Link>
  )
}
