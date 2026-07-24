'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { UserTable } from '@/components/users/user-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, AlertTriangle, Users, UserCheck, UserX, ShieldCheck, MailQuestion } from 'lucide-react'
import { User, Department } from '@/types'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { TableSkeleton } from '@/components/dashboard/skeletons'
import { UserFilter } from '@/components/shared/filters/user-filter'
import { TablePagination } from '@/components/shared/table-pagination'
import { EntityAvatar } from '@/components/shared/entity-avatar'
import { toast } from 'react-hot-toast'

const PAGE_SIZE = 8

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    phoneNumber: '',
    empCode: '',
    role: 'PROJECT_ASSISTANT',
    departmentId: '',
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Photo must be an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo must be under 2MB')
      return
    }

    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const resetUserForm = () => {
    setNewUser({
      email: '',
      name: '',
      phoneNumber: '',
      empCode: '',
      role: 'PROJECT_ASSISTANT',
      departmentId: '',
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setInviteLink(null)
  }

  const openCreateDialog = () => {
    setEditingUser(null)
    resetUserForm()
    setError('')
    setShowAddDialog(true)
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setNewUser({
      email: user.email || '',
      name: user.name || '',
      phoneNumber: user.phoneNumber || '',
      empCode: user.empCode || '',
      role: user.role === 'ADMIN' ? 'PROJECT_ASSISTANT' : user.role,
      departmentId: user.departmentId || '',
    })
    setPhotoFile(null)
    setPhotoPreview(user.photoUrl || null)
    setInviteLink(null)
    setError('')
    setShowAddDialog(true)
  }

  const closeUserDialog = () => {
    setShowAddDialog(false)
    setEditingUser(null)
    resetUserForm()
    setError('')
  }

  useEffect(() => {
    fetchUsers()
    fetchDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrg, filterRole])

  useEffect(() => {
    const q = searchQuery.toLowerCase()
    let result = users
    if (q) {
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.empCode?.toLowerCase().includes(q)
      )
    }
    if (filterMonth !== 'all' || filterYear !== 'all') {
      result = result.filter((u) => {
        const d = new Date(u.createdAt)
        if (filterMonth !== 'all' && String(d.getMonth() + 1).padStart(2, '0') !== filterMonth) return false
        if (filterYear !== 'all' && String(d.getFullYear()) !== filterYear) return false
        return true
      })
    }
    setFilteredUsers(result)
  }, [searchQuery, filterMonth, filterYear, users])

  const exportData = useMemo(() =>
    filteredUsers.map((u) => ({
      Name: u.name || '',
      Email: u.email || '',
      'Emp Code': u.empCode || '',
      Role: u.role,
      Department: u.department?.name || '',
      Status: u.isActive ? 'Active' : 'Inactive',
      Invite: u.status,
      'Joined on': new Date(u.createdAt).toLocaleDateString(),
    })),
    [filteredUsers]
  )

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    inactive: users.filter((u) => !u.isActive).length,
    admins: users.filter((u) => u.role === 'FACULTY').length,
    invited: users.filter((u) => u.status === 'INVITED').length,
  }), [users])

  const departmentNameById = useMemo(() => {
    return new Map(departments.map((org) => [org.id, org.name]))
  }, [departments])

  // Moderators act across the whole organization, so they carry no department.
  const isModerator = newUser.role === 'MODERATOR'

  // Clamp against a page a filter change may have left out of range.
  const safePage = Math.min(page, Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE)))
  const pagedUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  const handleOrgChange = (value: string) => {
    setFilterOrg(value)
    setPage(1)
  }

  const handleRoleChange = (value: string) => {
    setFilterRole(value)
    setPage(1)
  }

  const handleMonthChange = (value: string) => {
    setFilterMonth(value)
    setPage(1)
  }

  const handleYearChange = (value: string) => {
    setFilterYear(value)
    setPage(1)
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments')
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments)
      }
    } catch (error) {
      console.error('Error fetching departments:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `/api/users?departmentId=${filterOrg}&role=${filterRole === 'all' ? '' : filterRole}`
      )
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setFilteredUsers(data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('role', newUser.role)
      if (!isModerator) {
        formData.append('departmentId', newUser.departmentId)
      }
      if (newUser.role === 'FACULTY') {
        formData.append('empCode', newUser.empCode)
      } else {
        formData.append('email', newUser.email)
        formData.append('name', newUser.name)
        formData.append('phoneNumber', newUser.phoneNumber)
      }
      if (photoFile) formData.append('photo', photoFile)

      const response = await fetch(editingUser ? `/api/users/${editingUser.id}` : '/api/users', {
        method: editingUser ? 'PATCH' : 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      if (data.inviteLink) {
        setInviteLink(data.inviteLink)
      } else {
        closeUserDialog()
        toast.success(editingUser ? 'User updated successfully.' : 'Invite email sent to the user.')
      }
      fetchUsers()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="User Management" description="Invite, edit, and manage users across departments" />
        <Button
          className="gap-2 rounded-lg bg-indigo-600 px-4 text-white cursor-pointer hover:bg-indigo-700"
          disabled={departments.length === 0}
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" />
          Invite User
        </Button>
        <Dialog
          open={showAddDialog}
          onOpenChange={(open) => {
            if (open) {
              setShowAddDialog(true)
            } else {
              closeUserDialog()
            }
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Invite User'}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? 'Update the user details in the same form. Leave fields blank only if you want placeholders to remain visible.'
                  : 'An invite email will be sent to the user. They will set their own password after accepting.'}
              </DialogDescription>
            </DialogHeader>
            {inviteLink ? (
              <div className="space-y-4 pt-1">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs font-semibold text-emerald-700">Account created. Share this setup link with the faculty member:</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input readOnly value={inviteLink} className="text-xs" />
                    <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="button" className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700" onClick={closeUserDialog}>Done</Button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmitUser} className="space-y-4 pt-1">
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      value &&
                      setNewUser((prev) => ({
                        ...prev,
                        role: String(value),
                        departmentId: value === 'MODERATOR' ? '' : prev.departmentId,
                      }))
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-40 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROJECT_ASSISTANT">Project Assistant</SelectItem>
                      <SelectItem value="FACULTY">Faculty</SelectItem>
                      <SelectItem value="MODERATOR">Moderator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </Label>
                  <Select
                    value={newUser.departmentId}
                    onValueChange={(value) => value && setNewUser({ ...newUser, departmentId: value })}
                    disabled={submitting || isModerator}
                  >
                    <SelectTrigger className="w-44 text-sm">
                      <SelectValue placeholder="Select org">
                        {(value) =>
                          isModerator
                            ? 'Organization-wide'
                            : typeof value === 'string'
                              ? departmentNameById.get(value) || 'Select org'
                              : 'Select org'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isModerator && (
                    <p className="text-[11px] text-slate-400">
                      Moderators belong to the organization, not a department.
                    </p>
                  )}
                </div>
              </div>

              {newUser.role === 'FACULTY' ? (
                <div className="space-y-1.5">
                  <Label htmlFor="empCode" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee Code
                  </Label>
                  <Input
                    id="empCode"
                    placeholder="e.g. FAC1029"
                    value={newUser.empCode}
                    onChange={(e) => setNewUser({ ...newUser, empCode: e.target.value })}
                    required
                    disabled={submitting}
                    className="text-sm"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      disabled={submitting}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      disabled={submitting}
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phoneNumber" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Phone Number (optional)
                    </Label>
                    <Input
                      id="phoneNumber"
                      placeholder="10-digit mobile"
                      value={newUser.phoneNumber}
                      onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                      disabled={submitting}
                      className="text-sm"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="photo" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Photo
                </Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <EntityAvatar
                    name={newUser.name}
                    fallbackText={newUser.email || newUser.empCode || 'User'}
                    imageUrl={photoPreview}
                    className="h-12 w-12 border border-slate-200"
                  />
                  <div className="flex flex-col gap-1.5 sm:flex-1">
                    <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    <label
                      htmlFor="photo"
                      className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:w-fit"
                    >
                      Choose File
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {photoFile
                        ? photoFile.name
                        : editingUser?.photoUrl
                          ? 'Current photo attached'
                          : 'PNG, JPG, or WEBP up to 2MB'}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  size="sm"
                  onClick={closeUserDialog}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      {editingUser ? 'Updating user...' : 'Sending invite...'}
                    </>
                  ) : (
                    editingUser ? 'Update User' : 'Send Invite'
                  )}
                </Button>
              </div>
            </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {departments.length === 0 && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">
            Please create an department first before adding users.{' '}
            <Link href="/admin/departments" className="font-semibold underline hover:text-amber-900">
              Create Department
            </Link>
          </p>
        </div>
      )}

      {/* Metadata cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Users className="h-4 w-4 text-indigo-600" />} label="Total Users" value={stats.total} accent="bg-indigo-50" />
        <StatCard icon={<UserCheck className="h-4 w-4 text-emerald-600" />} label="Active" value={stats.active} accent="bg-emerald-50" />
        <StatCard icon={<UserX className="h-4 w-4 text-slate-500" />} label="Inactive" value={stats.inactive} accent="bg-slate-100" />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-violet-600" />} label="Faculty" value={stats.admins} accent="bg-violet-50" />
        <StatCard icon={<MailQuestion className="h-4 w-4 text-amber-600" />} label="Pending Invites" value={stats.invited} accent="bg-amber-50" />
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={searchQuery} onChange={handleSearchChange} className="w-full sm:max-w-md" />
        <UserFilter
          showOrgFilter
          includeModerator
          departments={departments}
          filterOrg={filterOrg}
          filterRole={filterRole}
          filterMonth={filterMonth}
          filterYear={filterYear}
          onOrgChange={handleOrgChange}
          onRoleChange={handleRoleChange}
          onMonthChange={handleMonthChange}
          onYearChange={handleYearChange}
          exportData={exportData}
          exportFilename="users-export"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <>
          <UserTable
            users={pagedUsers}
            mode="super-admin"
            departments={departments}
            onEditUser={openEditDialog}
            onUserUpdated={fetchUsers}
            attendanceLinkPrefix="/admin/attendance"
          />
          <TablePagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={filteredUsers.length}
            onPageChange={setPage}
            className="mt-3 rounded-xl border border-slate-100 bg-white"
          />
        </>
      )}
    </div>
  )
}
