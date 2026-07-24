"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import { cn } from "@/lib/utils"
import type { User, Department } from "@/types"

const ROLE_LABEL: Record<User["role"], string> = {
  PROJECT_ASSISTANT: "Project Assistant",
  FACULTY: "Faculty",
  ADMIN: "Admin",
  MODERATOR: "Moderator",
}

const ROLE_STYLES: Record<User["role"], string> = {
  PROJECT_ASSISTANT: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/60",
  FACULTY: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
  ADMIN: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/60",
  MODERATOR: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/60",
}

function getStatusBadge(status: string) {
  return status === "ACCEPTED" ? (
    <Badge className="border border-emerald-100 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700">Accepted</Badge>
  ) : (
    <Badge className="border border-amber-100 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700">Invited</Badge>
  )
}

export function UserTable({
  users,
  mode,
  onEditUser,
  onUserUpdated,
  attendanceLinkPrefix,
}: {
  users: User[]
  mode: "super-admin" | "admin"
  departments?: Department[]
  onEditUser?: (user: User) => void
  onUserUpdated: () => void
  attendanceLinkPrefix: string
}) {
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    setUpdatingUserId(userId)
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })
      onUserUpdated()
    } finally {
      setUpdatingUserId(null)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Member</TableHead>
              {mode === "super-admin" && <TableHead>Department</TableHead>}
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Invite</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="pr-3 text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={mode === "super-admin" ? 7 : 6} className="py-8 text-center text-sm text-slate-400">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={updatingUserId === user.id ? "pointer-events-none opacity-40" : ""}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <EntityAvatar name={user.name} fallbackText={user.email || user.empCode} imageUrl={user.photoUrl} className="h-9 w-9 border border-slate-200" />
                      <div className="flex flex-col">
                        <Link href={`${attendanceLinkPrefix}/${user.id}`} className="text-xs font-semibold text-slate-800 hover:underline">
                          {user.name || user.empCode || "Unnamed"}
                        </Link>
                        <span className="text-[10px] text-slate-400">{user.email || user.empCode}</span>
                      </div>
                    </div>
                  </TableCell>
                  {mode === "super-admin" && (
                    <TableCell className="text-xs text-slate-600">{user.department?.name || "—"}</TableCell>
                  )}
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        ROLE_STYLES[user.role]
                      )}
                    >
                      {ROLE_LABEL[user.role] ?? user.role}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{getStatusBadge(user.status)}</TableCell>
                  <TableCell className="hidden text-xs text-slate-500 sm:table-cell">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={(checked: boolean) => handleToggleStatus(user.id, checked)}
                      className="scale-75 data-checked:bg-emerald-500"
                    />
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => onEditUser?.(user)} className="h-6 w-6 text-slate-400 hover:text-slate-800">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
