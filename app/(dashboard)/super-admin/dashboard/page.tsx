"use client";

import { useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    AlertTriangle,
    Building2,
    Check,
    CheckCircle2,
    Clock,
    KeyRound,
    LogIn,
    ShieldAlert,
    UserPlus,
    Users,
    X,
} from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Mock data — swap these for real API calls
// ---------------------------------------------------------------------------

const STATS = [
    {
        label: "Total Organizations",
        value: "128",
        delta: "+6 this month",
        deltaPositive: true,
        icon: Building2,
        accent: "bg-indigo-50 text-indigo-600",
    },
    {
        label: "Total Users",
        value: "4,382",
        sub: "312 admins · 4,070 users",
        icon: Users,
        accent: "bg-violet-50 text-violet-600",
    },
    {
        label: "Today's Attendance",
        value: "91.4%",
        delta: "+2.1% vs yesterday",
        deltaPositive: true,
        icon: CheckCircle2,
        accent: "bg-emerald-50 text-emerald-600",
    },
    {
        label: "Pending Leaves",
        value: "17",
        delta: "5 need review today",
        deltaPositive: false,
        icon: Clock,
        accent: "bg-amber-50 text-amber-600",
    },
];

const ATTENDANCE_DATA = [
    { day: "Mon", onTime: 320, late: 28, absent: 14 },
    { day: "Tue", onTime: 305, late: 34, absent: 21 },
    { day: "Wed", onTime: 312, late: 22, absent: 18 },
    { day: "Thu", onTime: 298, late: 41, absent: 25 },
    { day: "Fri", onTime: 331, late: 19, absent: 12 },
    { day: "Sat", onTime: 210, late: 15, absent: 30 },
    { day: "Sun", onTime: 96, late: 6, absent: 10 },
];

type LeaveRequest = {
    id: string;
    name: string;
    initials: string;
    org: string;
    type: string;
    dates: string;
};

const INITIAL_LEAVES: LeaveRequest[] = [
    { id: "1", name: "Sara Malik", initials: "SM", org: "Nova Retail", type: "Sick leave", dates: "Jul 8 – Jul 9" },
    { id: "2", name: "Ahmed Raza", initials: "AR", org: "Bright Logistics", type: "Annual leave", dates: "Jul 10 – Jul 14" },
    { id: "3", name: "Lina Chen", initials: "LC", org: "Nova Retail", type: "Casual leave", dates: "Jul 8" },
    { id: "4", name: "Omar Farooq", initials: "OF", org: "Vertex Labs", type: "Sick leave", dates: "Jul 9 – Jul 10" },
];

const LOG_ICON_MAP = {
    login: { icon: LogIn, accent: "bg-indigo-50 text-indigo-600" },
    user: { icon: UserPlus, accent: "bg-emerald-50 text-emerald-600" },
    security: { icon: ShieldAlert, accent: "bg-red-50 text-red-600" },
    password: { icon: KeyRound, accent: "bg-amber-50 text-amber-600" },
    alert: { icon: AlertTriangle, accent: "bg-red-50 text-red-600" },
} as const;

const SYSTEM_LOGS: {
    id: string;
    type: keyof typeof LOG_ICON_MAP;
    message: string;
    meta: string;
    time: string;
}[] = [
        { id: "1", type: "login", message: "Admin login from new device", meta: "Nova Retail · IP 103.21.4.12", time: "2m ago" },
        { id: "2", type: "user", message: "New organization onboarded", meta: "Vertex Labs", time: "18m ago" },
        { id: "3", type: "security", message: "3 failed login attempts", meta: "Bright Logistics · user: k.hussain", time: "42m ago" },
        { id: "4", type: "password", message: "Password reset completed", meta: "user: d.ahmadi", time: "1h ago" },
        { id: "5", type: "alert", message: "Storage usage above 85%", meta: "System · region ap-south-1", time: "3h ago" },
    ];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuperAdminDashboard() {
    const [leaves, setLeaves] = useState(INITIAL_LEAVES);

    function resolveLeave(id: string) {
        setLeaves((prev) => prev.filter((leave) => leave.id !== id));
    }

    return (
        <div>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Super Admin Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Overview across all organizations on the platform.
                    </p>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STATS.map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-xl",
                                        stat.accent
                                    )}
                                >
                                    <stat.icon className="h-5 w-5" />
                                </span>
                            </div>
                            <p className="mt-4 text-2xl font-semibold text-slate-900">
                                {stat.value}
                            </p>
                            <p className="text-sm text-slate-500">{stat.label}</p>
                            {stat.sub && (
                                <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
                            )}
                            {stat.delta && (
                                <p
                                    className={cn(
                                        "mt-1 text-xs font-medium",
                                        stat.deltaPositive ? "text-emerald-600" : "text-amber-600"
                                    )}
                                >
                                    {stat.delta}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Chart + side widgets */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    {/* Multi bar chart */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">
                                    Weekly Attendance Breakdown
                                </h2>
                                <p className="text-sm text-slate-500">
                                    On time vs. late vs. absent, across all organizations.
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={ATTENDANCE_DATA} barGap={4}>
                                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="day"
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                                        width={32}
                                    />
                                    <Tooltip
                                        cursor={{ fill: "#f8fafc" }}
                                        contentStyle={{
                                            borderRadius: 12,
                                            border: "1px solid #e2e8f0",
                                            fontSize: 12,
                                        }}
                                    />
                                    <Legend
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: 12, color: "#64748b" }}
                                    />
                                    <Bar
                                        dataKey="onTime"
                                        name="On time"
                                        fill="#6366f1"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="late"
                                        name="Late"
                                        fill="#f59e0b"
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="absent"
                                        name="Absent"
                                        fill="#ef4444"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Leave approval widget */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-semibold text-slate-900">
                                Leave Approvals
                            </h2>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                                {leaves.length} pending
                            </span>
                        </div>

                        <div className="mt-4 space-y-3">
                            {leaves.length === 0 && (
                                <p className="py-6 text-center text-sm text-slate-400">
                                    All caught up — no pending leave requests.
                                </p>
                            )}

                            {leaves.map((leave) => (
                                <div
                                    key={leave.id}
                                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                                >
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                                        {leave.initials}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                            {leave.name}
                                        </p>
                                        <p className="truncate text-xs text-slate-400">
                                            {leave.org} · {leave.type} · {leave.dates}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 gap-1.5">
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-600"
                                            onClick={() => resolveLeave(leave.id)}
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-500"
                                            onClick={() => resolveLeave(leave.id)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Link href="/super-admin/leave">
                            <button className="mt-4 w-full text-center text-sm font-medium text-indigo-600 hover:underline">
                                View all leave requests
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Recent system logs */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">
                            Recent System Logs
                        </h2>
                        <button className="text-sm font-medium text-indigo-600 hover:underline">
                            View all
                        </button>
                    </div>

                    <div className="mt-4 divide-y divide-slate-100">
                        {SYSTEM_LOGS.map((log) => {
                            const meta = LOG_ICON_MAP[log.type];
                            const Icon = meta.icon;
                            return (
                                <div key={log.id} className="flex items-center gap-3 py-3">
                                    <span
                                        className={cn(
                                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                                            meta.accent
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900">
                                            {log.message}
                                        </p>
                                        <p className="truncate text-xs text-slate-400">
                                            {log.meta}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs text-slate-400">
                                        {log.time}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}