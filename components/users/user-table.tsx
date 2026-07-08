"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { EntityAvatar } from "@/components/shared/entity-avatar"
import type { User, Organization } from "@/types"

function getUserTypeBadge(userType: string) {
  switch (userType) {
    case "INTERN":
      return <Badge className="border border-orange-100 bg-orange-50 px-1.5 py-0 text-[10px] text-orange-700">Intern</Badge>
    case "CONTRACTUAL":
      return <Badge className="border border-violet-100 bg-violet-50 px-1.5 py-0 text-[10px] text-violet-700">Contract</Badge>
    default:
      return <Badge className="border border-emerald-100 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700">Employee</Badge>
  }
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
  organizations?: Organization[]
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

  const handleToggleRole = async (userId: string, role: string) => {
    setUpdatingUserId(userId)
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
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
              {mode === "super-admin" && <TableHead>Organization</TableHead>}
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden sm:table-cell">Invite</TableHead>
              <TableHead className="hidden sm:table-cell">Joined</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="pr-3 text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={mode === "super-admin" ? 8 : 7} className="py-8 text-center text-sm text-slate-400">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={updatingUserId === user.id ? "pointer-events-none opacity-40" : ""}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <EntityAvatar name={user.name} fallbackText={user.email} imageUrl={user.photoUrl} className="h-9 w-9 border border-slate-200" />
                      <div className="flex flex-col">
                        <Link href={`${attendanceLinkPrefix}/${user.id}`} className="text-xs font-semibold text-slate-800 hover:underline">
                          {user.name || "Unnamed"}
                        </Link>
                        <span className="text-[10px] text-slate-400">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  {mode === "super-admin" && (
                    <TableCell className="text-xs text-slate-600">{user.organization?.name || "—"}</TableCell>
                  )}
                  <TableCell>
                    <Select value={user.role} onValueChange={(v) => v && handleToggleRole(user.id, v)}>
                      <SelectTrigger className="h-6 w-20 border-slate-200 bg-transparent px-2 text-[11px] font-medium shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{getUserTypeBadge(user.userType)}</TableCell>
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
