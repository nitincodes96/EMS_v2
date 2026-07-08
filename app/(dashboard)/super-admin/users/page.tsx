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
import { User, Organization } from '@/types'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { TableSkeleton } from '@/components/dashboard/skeletons'
import { UserFilter } from '@/components/shared/filters/user-filter'
import { EntityAvatar } from '@/components/shared/entity-avatar'
import { toast } from 'react-hot-toast'

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
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [filterUserType, setFilterUserType] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterYear, setFilterYear] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    phoneNumber: '',
    aadharNumber: '',
    panNumber: '',
    dateOfBirth: '',
    role: 'USER',
    userType: 'EMPLOYEE',
    organizationId: '',
    basicSalary: '',
    hra: '',
    tdsPercent: '',
    pfPercent: '',
    lopEnabled: true,
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [resumeFile, setResumeFile] = useState<File | null>(null)

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

  const handleResumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const isPdfType = file.type === 'application/pdf'
    const isPdfName = file.name.toLowerCase().endsWith('.pdf')
    if (!isPdfType && !isPdfName) {
      setError('Resume must be a PDF file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Resume must be under 5MB')
      return
    }
    setResumeFile(file)
  }

  const resetUserForm = () => {
    setNewUser({
      email: '',
      name: '',
      phoneNumber: '',
      aadharNumber: '',
      panNumber: '',
      dateOfBirth: '',
      role: 'USER',
      userType: 'EMPLOYEE',
      organizationId: '',
      basicSalary: '',
      hra: '',
      tdsPercent: '',
      pfPercent: '',
      lopEnabled: true,
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setResumeFile(null)
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
      email: user.email,
      name: user.name || '',
      phoneNumber: user.phoneNumber || '',
      aadharNumber: user.aadharNumber || '',
      panNumber: user.panNumber || '',
      dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
      role: user.role === 'SUPER_ADMIN' ? 'USER' : user.role,
      userType: user.role === 'ADMIN' ? 'EMPLOYEE' : user.userType,
      organizationId: user.organizationId || '',
      basicSalary: user.basicSalary?.toString() || '',
      hra: user.hra?.toString() || '',
      tdsPercent: user.tdsPercent?.toString() || '',
      pfPercent: user.pfPercent?.toString() || '',
      lopEnabled: user.lopEnabled ?? true,
    })
    setPhotoFile(null)
    setPhotoPreview(user.photoUrl || null)
    setResumeFile(null)
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
    fetchOrganizations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrg, filterRole, filterUserType])

  useEffect(() => {
    const q = searchQuery.toLowerCase()
    let result = users
    if (q) {
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
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
      Email: u.email,
      Role: u.role,
      'User Type': u.userType,
      Organization: u.organization?.name || '',
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
    admins: users.filter((u) => u.role === 'ADMIN').length,
    invited: users.filter((u) => u.status === 'INVITED').length,
  }), [users])

  const organizationNameById = useMemo(() => {
    return new Map(organizations.map((org) => [org.id, org.name]))
  }, [organizations])

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `/api/users?organizationId=${filterOrg}&role=${filterRole === 'all' ? '' : filterRole}&userType=${filterUserType === 'all' ? '' : filterUserType}`
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
      formData.append('email', newUser.email)
      formData.append('name', newUser.name)
      formData.append('phoneNumber', newUser.phoneNumber)
      formData.append('aadharNumber', newUser.aadharNumber)
      formData.append('panNumber', newUser.panNumber)
      formData.append('dateOfBirth', newUser.dateOfBirth)
      if (resumeFile) formData.append('resume', resumeFile)
      formData.append('role', newUser.role)
      formData.append('userType', newUser.userType)
      formData.append('organizationId', newUser.organizationId)
      if (newUser.basicSalary !== '') formData.append('basicSalary', newUser.basicSalary)
      if (newUser.hra !== '') formData.append('hra', newUser.hra)
      formData.append('tdsPercent', newUser.tdsPercent)
      formData.append('pfPercent', newUser.pfPercent)
      formData.append('lopEnabled', String(newUser.lopEnabled))
      if (photoFile) formData.append('photo', photoFile)

      const response = await fetch(editingUser ? `/api/users/${editingUser.id}` : '/api/users', {
        method: editingUser ? 'PATCH' : 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      closeUserDialog()
      toast.success(editingUser ? 'User updated successfully.' : 'Invite email sent to the user.')
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
        <PageHeader title="User Management" description="Invite, edit, and manage users across organizations" />
        <Button
          className="gap-2 rounded-lg bg-indigo-600 px-4 text-white cursor-pointer hover:bg-indigo-700"
          disabled={organizations.length === 0}
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
            <form onSubmit={handleSubmitUser} className="space-y-4 pt-1">
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

              <div className="space-y-2">
                <Label htmlFor="photo" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Photo
                </Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <EntityAvatar
                    name={newUser.name}
                    fallbackText={newUser.email || 'User'}
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

              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1.5">
                  <Label htmlFor="dateOfBirth" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date of Birth (optional)
                  </Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={newUser.dateOfBirth}
                    onChange={(e) => setNewUser({ ...newUser, dateOfBirth: e.target.value })}
                    disabled={submitting}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="aadharNumber" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Aadhar Number (optional)
                  </Label>
                  <Input
                    id="aadharNumber"
                    placeholder="12-digit Aadhar"
                    value={newUser.aadharNumber}
                    onChange={(e) => setNewUser({ ...newUser, aadharNumber: e.target.value })}
                    disabled={submitting}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="panNumber" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    PAN Number (optional)
                  </Label>
                  <Input
                    id="panNumber"
                    placeholder="ABCDE1234F"
                    value={newUser.panNumber}
                    onChange={(e) => setNewUser({ ...newUser, panNumber: e.target.value.toUpperCase() })}
                    disabled={submitting}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="resume" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Resume (PDF, optional)
                </Label>
                <div className="flex flex-col gap-1.5">
                  <Input
                    id="resume"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleResumeChange}
                    disabled={submitting}
                    className="hidden"
                  />
                  <label
                    htmlFor="resume"
                    className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Choose File
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {resumeFile
                      ? resumeFile.name
                      : editingUser?.resumeUrl
                        ? 'Current resume attached'
                        : 'PDF up to 5MB'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) =>
                      value && setNewUser({ ...newUser, role: value, userType: value === 'ADMIN' ? 'EMPLOYEE' : newUser.userType })
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-32 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User Type
                  </Label>
                  <Select
                    value={newUser.userType}
                    onValueChange={(value) => value && setNewUser({ ...newUser, userType: value })}
                    disabled={submitting || newUser.role === 'ADMIN'}
                  >
                    <SelectTrigger className="w-36 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                      <SelectItem value="INTERN">Intern</SelectItem>
                      <SelectItem value="CONTRACTUAL">Contractual</SelectItem>
                    </SelectContent>
                  </Select>
                  {newUser.role === 'ADMIN' && (
                    <p className="text-[10px] text-slate-400">Admins are always Employees</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Organization
                  </Label>
                  <Select
                    value={newUser.organizationId}
                    onValueChange={(value) => value && setNewUser({ ...newUser, organizationId: value })}
                    disabled={submitting}
                  >
                    <SelectTrigger className="w-44 text-sm">
                      <SelectValue placeholder="Select org">
                        {(value) => (typeof value === 'string' ? organizationNameById.get(value) || 'Select org' : 'Select org')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Salary</Label>
                  <Input
                    type="number"
                    placeholder='Enter Basic Salary'
                    min="0"
                    value={newUser.basicSalary}
                    onChange={(e) => setNewUser({ ...newUser, basicSalary: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">HRA</Label>
                  <Input
                    type="number"
                    placeholder='Enter HRA'
                    min="0"
                    value={newUser.hra}
                    onChange={(e) => setNewUser({ ...newUser, hra: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">TDS % (optional)</Label>
                  <Input
                    type="number"
                    placeholder='Enter TDS %'
                    min="0"
                    max="100"
                    value={newUser.tdsPercent}
                    onChange={(e) => setNewUser({ ...newUser, tdsPercent: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">PF % (optional)</Label>
                  <Input
                    type="number"
                    placeholder='Enter PF %'
                    min="0"
                    max="100"
                    value={newUser.pfPercent}
                    onChange={(e) => setNewUser({ ...newUser, pfPercent: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Apply LOP</p>
                  <p className="text-[11px] text-slate-400">[(BASIC + HRA - (TDS + PF)) / daysInMonth] * unpaid leaves; half-day rule applies</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewUser({ ...newUser, lopEnabled: !newUser.lopEnabled })}
                >
                  {newUser.lopEnabled ? 'Enabled' : 'Disabled'}
                </Button>
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
          </DialogContent>
        </Dialog>
      </div>

      {organizations.length === 0 && !loading && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-sm">
            Please create an organization first before adding users.{' '}
            <Link href="/super-admin/organizations" className="font-semibold underline hover:text-amber-900">
              Create Organization
            </Link>
          </p>
        </div>
      )}

      {/* Metadata cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={<Users className="h-4 w-4 text-indigo-600" />} label="Total Users" value={stats.total} accent="bg-indigo-50" />
        <StatCard icon={<UserCheck className="h-4 w-4 text-emerald-600" />} label="Active" value={stats.active} accent="bg-emerald-50" />
        <StatCard icon={<UserX className="h-4 w-4 text-slate-500" />} label="Inactive" value={stats.inactive} accent="bg-slate-100" />
        <StatCard icon={<ShieldCheck className="h-4 w-4 text-violet-600" />} label="Admins" value={stats.admins} accent="bg-violet-50" />
        <StatCard icon={<MailQuestion className="h-4 w-4 text-amber-600" />} label="Pending Invites" value={stats.invited} accent="bg-amber-50" />
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={searchQuery} onChange={setSearchQuery} className="w-full sm:max-w-md" />
        <UserFilter
          showOrgFilter
          organizations={organizations}
          filterOrg={filterOrg}
          filterRole={filterRole}
          filterUserType={filterUserType}
          filterMonth={filterMonth}
          filterYear={filterYear}
          onOrgChange={setFilterOrg}
          onRoleChange={setFilterRole}
          onUserTypeChange={setFilterUserType}
          onMonthChange={setFilterMonth}
          onYearChange={setFilterYear}
          exportData={exportData}
          exportFilename="users-export"
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : (
        <UserTable
          users={filteredUsers}
          mode="super-admin"
          organizations={organizations}
          onEditUser={openEditDialog}
          onUserUpdated={fetchUsers}
          attendanceLinkPrefix="/super-admin/attendance"
        />
      )}
    </div>
  )
}
