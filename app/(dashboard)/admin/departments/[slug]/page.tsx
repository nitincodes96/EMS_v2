'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  ArrowLeft,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  AlertTriangle,
  Search,
  RefreshCw,
  UserCheck,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { DepartmentDetailSkeleton } from '@/components/dashboard/skeletons'
import { UserFilter } from '@/components/shared/filters/user-filter'
import { format } from 'date-fns'
import { EntityAvatar } from '@/components/shared/entity-avatar'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface User {
  id: string
  email: string | null
  empCode?: string | null
  name: string | null
  photoUrl?: string | null
  phoneNumber?: string | null
  role: 'PROJECT_ASSISTANT' | 'FACULTY' | 'ADMIN' | 'MODERATOR'
  isActive: boolean
  status: string
  joiningDate?: string | null
  createdAt: string
}

interface Leave {
  id: string
  startDate: string
  endDate: string
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  user: User
}

interface Attendance {
  id: string
  checkInTime: string
  checkOutTime: string | null
  latitude: number | null
  longitude: number | null
  user: User
}

interface DepartmentDetails {
  id: string
  name: string
  description: string | null
  logoUrl?: string | null
  createdAt: string
  users: User[]
  leaves: Leave[]
  attendances: Attendance[]
  absentUsers: User[]
  stats: {
    adminsCount: number
    activeUsersCount: number
    inactiveUsersCount: number
    totalUsersCount: number
    pendingLeavesCount: number
  }
}

type SidebarTab = 'activity' | 'leaves'

const ROLE_LABELS: Record<string, string> = {
  PROJECT_ASSISTANT: 'Project Assistant',
  FACULTY: 'Faculty',
  MODERATOR: 'Moderator',
  ADMIN: 'Admin',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DepartmentDetailsPage() {
  const params = useParams()
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug
  const router = useRouter()

  // ── Core state ──
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<DepartmentDetails | null>(null)
  const [error, setError] = useState('')

  // ── Add User state ──
  const [submitting, setSubmitting] = useState(false)

  // ── Staff management state ──
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ userId: string; isActive: boolean } | null>(null)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  // ── Edit Member state ──
  const [showEditMemberDialog, setShowEditMemberDialog] = useState(false)
  const [editingMember, setEditingMember] = useState<User | null>(null)
  const [editFormData, setEditFormData] = useState({
    name: '',
    phoneNumber: '',
  })
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)

  // ── Leave action state ──
  const [actioningLeaveId, setActioningLeaveId] = useState<string | null>(null)

  // ── Search state ──
  const [staffSearch, setStaffSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterYear, setFilterYear] = useState('all')

  // ── Sidebar tab state ──
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('activity')

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchDetails = (showSkeleton = false) => {
    if (!slug) return
    if (showSkeleton) setLoading(true)
    fetch(`/api/departments/slug/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.department) setOrg(data.department)
        else setError(data.error || 'Failed to fetch department details')
      })
      .catch(() => setError('An error occurred while fetching data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDetails(true)
  }, [slug])

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

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditPhotoFile(file)
      setEditPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleStatus = (userId: string, isActive: boolean) => {
    setConfirmAction({ userId, isActive })
    setConfirmDialogOpen(true)
  }

  const confirmToggleStatus = async () => {
    if (!confirmAction) return
    setUpdatingUser(confirmAction.userId)
    try {
      const response = await fetch(`/api/users/${confirmAction.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: confirmAction.isActive }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      fetchDetails()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setConfirmDialogOpen(false)
      setConfirmAction(null)
      setUpdatingUser(null)
    }
  }

  const openEditMemberDialog = (member: User) => {
    setEditingMember(member)
    setEditFormData({
      name: member.name || '',
      phoneNumber: member.phoneNumber || '',
    })
    setEditPhotoFile(null)
    setEditPhotoPreview(member.photoUrl || null)
    setShowEditMemberDialog(true)
  }

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', editFormData.name)
      // Faculty are Kerberos-provisioned and carry no employee code.
      if (editingMember.role !== 'FACULTY') {
        formData.append('phoneNumber', editFormData.phoneNumber)
      }
      if (editPhotoFile) formData.append('photo', editPhotoFile)

      const response = await fetch(`/api/users/${editingMember.id}`, {
        method: 'PATCH',
        body: formData,
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Failed to update member')
      setShowEditMemberDialog(false)
      fetchDetails()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update member')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLeaveAction = async (leaveId: string, status: 'APPROVED' | 'REJECTED') => {
    setActioningLeaveId(leaveId)
    try {
      const response = await fetch(`/api/leaves/${leaveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error(`Failed to ${status.toLowerCase()} leave`)
      fetchDetails()
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${status.toLowerCase()} leave`)
    } finally {
      setActioningLeaveId(null)
    }
  }


  if (loading) return <DepartmentDetailSkeleton />

  if (error || !org) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Department not found'}
        </div>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/departments')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Departments
        </Button>
      </div>
    )
  }

  const filteredUsers = org.users.filter((m) => {
    const q = staffSearch.toLowerCase()
    const matchesSearch = !staffSearch ||
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.empCode?.toLowerCase().includes(q)
    const matchesRole = filterRole === 'all' || m.role === filterRole
    const joined = new Date(m.createdAt)
    const matchesMonth = filterMonth === 'all' || (joined.getMonth() + 1) === parseInt(filterMonth)
    const matchesYear = filterYear === 'all' || joined.getFullYear() === parseInt(filterYear)
    return matchesSearch && matchesRole && matchesMonth && matchesYear
  })

  const exportData = filteredUsers.map((m) => ({
    Name: m.name || '',
    Email: m.email || '',
    'Emp Code': m.empCode || '',
    Role: m.role,
    Active: m.isActive ? 'Yes' : 'No',
    'Joined': new Date(m.createdAt).toLocaleDateString('en-CA'),
  }))

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-0 pb-4">

      {/* ── Compact Header ── */}
      <div className="flex items-center justify-between px-1 py-3 border-b border-slate-100 mb-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/admin/departments')}
            className="h-7 w-7 cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-slate-600" />
          </Button>
          <EntityAvatar
            name={org.name}
            imageUrl={org.logoUrl}
            rounded="xl"
            fit="contain"
            className="h-11 w-11 border border-slate-200 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none truncate">{org.name}</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex bg-slate-100 text-slate-500 font-normal text-[10px] px-1.5 py-0 shrink-0">
                Est. {format(new Date(org.createdAt), 'yyyy')}
              </Badge>
            </div>
            {org.description && (
              <p className="text-xs text-slate-400 mt-0.5 leading-none truncate hidden sm:block">{org.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Stat pills */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
              <Users className="h-3 w-3 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">{org.stats.totalUsersCount}</span>
              <span className="text-[10px] text-slate-400">members</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
              <UserCheck className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600">{org.attendances.length}</span>
              <span className="text-[10px] text-emerald-500">present</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid gap-4 lg:grid-cols-6 items-start flex-1 min-h-0">

        {/* ── Staff Table (4/6) ── */}
        <Card className="lg:col-span-4 shadow-sm border-none overflow-hidden flex flex-col">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-2.5 px-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <CardTitle className="text-sm font-semibold text-slate-700">Staff Members</CardTitle>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-500">{org.users.length}</Badge>
              </div>
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="pl-7 h-7 text-xs w-full sm:w-44 bg-white"
                />
              </div>
            </div>
            <div className="pt-2">
              <UserFilter
                filterOrg="all"
                filterRole={filterRole}
                filterMonth={filterMonth}
                filterYear={filterYear}
                onOrgChange={() => { }}
                onRoleChange={setFilterRole}
                onMonthChange={setFilterMonth}
                onYearChange={setFilterYear}
                exportData={exportData}
                exportFilename={`${org.name.toLowerCase().replace(/\s+/g, '-')}-staff`}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <Table>
              <TableHeader className="bg-slate-50/70 sticky top-0 z-10">
                <TableRow className="border-b border-slate-100">
                  <TableHead className="pl-4 py-2 text-[11px] font-semibold text-slate-500 h-8">Member</TableHead>
                  <TableHead className="py-2 text-[11px] font-semibold text-slate-500 h-8">Role</TableHead>
                  <TableHead className="py-2 text-[11px] font-semibold text-slate-500 h-8 hidden sm:table-cell">Joining Date</TableHead>
                  <TableHead className="text-center py-2 text-[11px] font-semibold text-slate-500 h-8">Active</TableHead>
                  <TableHead className="pr-3 text-right py-2 text-[11px] font-semibold text-slate-500 h-8">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                      {staffSearch ? 'No matching members.' : 'No staff added yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((member) => (
                    <TableRow
                      key={member.id}
                      className={'border-b border-slate-50 ' + (updatingUser === member.id ? 'opacity-40 pointer-events-none' : '')}
                    >
                      <TableCell className="pl-4 py-2">
                        <div className="flex items-center gap-3">
                          <EntityAvatar name={member.name} fallbackText={member.email || member.empCode} imageUrl={member.photoUrl} className="h-9 w-9 border border-slate-200" />
                          <div className="flex flex-col">
                            <Link href={`/admin/attendance/${member.id}`} className="text-xs font-semibold text-slate-800 hover:underline leading-tight">
                              {member.name || member.empCode || 'Unnamed'}
                            </Link>
                            <span className="text-[10px] text-slate-400 leading-tight">{member.email || member.empCode}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {/* Read-only: a role is fixed once the account exists. */}
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium text-[10px] px-2 py-0">
                          {ROLE_LABELS[member.role] ?? member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 hidden sm:table-cell">
                        <span className="text-[11px] text-slate-600 font-medium">
                          {/* joiningDate is only stamped on invite acceptance, so
                              fall back to the account creation date. */}
                          {member.status === 'ACCEPTED'
                            ? format(new Date(member.joiningDate || member.createdAt), 'dd MMM yyyy')
                            : '--'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Switch
                          checked={member.isActive}
                          onCheckedChange={(checked: boolean) => handleToggleStatus(member.id, checked)}
                          className="data-checked:bg-emerald-500 scale-75"
                        />
                      </TableCell>
                      <TableCell className="text-right pr-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditMemberDialog(member)} className="h-6 w-6 text-slate-400 hover:text-slate-800 cursor-pointer">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Tabbed Sidebar (2/5) ── */}
        <div className="lg:col-span-2 flex flex-col gap-0 border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white text-xs">

          {/* Tab nav */}
          <div className="flex border-b border-slate-100 bg-slate-50/60">
            {([
              { key: 'activity', label: 'Activity', icon: Activity, dot: null },
              // Leave is retired in favour of PA unavailability notices, so its tab stays hidden.
            ] as { key: SidebarTab; label: string; icon: LucideIcon; dot: number | null }[]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSidebarTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors relative ${
                  sidebarTab === tab.key
                    ? 'text-slate-900 bg-white border-b-2 border-b-(--theme) shadow-sm'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.dot !== null && (
                  <span className="ml-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0 rounded-full leading-4">
                    {tab.dot}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Activity Tab ── */}
          {sidebarTab === 'activity' && (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{format(new Date(), 'EEE, MMM d')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    {org.attendances.length} present
                  </span>
                  <span className="text-[10px] text-slate-400">·</span>
                  <span className="text-[10px] text-red-400 font-semibold">{org.absentUsers.length} absent</span>
                </div>
              </div>
              <div className="overflow-y-auto px-2 pb-2" style={{ maxHeight: '420px' }}>
                {org.attendances.map((record) => (
                  <div key={record.id} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg">
                    <EntityAvatar name={record.user.name} fallbackText={record.user.email} imageUrl={record.user.photoUrl} size="sm" className="h-7 w-7 border border-emerald-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{record.user.name}</p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        In: <span className="text-emerald-600 font-medium">{format(new Date(record.checkInTime), 'hh:mm a')}</span>
                        {record.checkOutTime && <> · Out: {format(new Date(record.checkOutTime), 'hh:mm a')}</>}
                      </p>
                    </div>
                    {!record.checkOutTime && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                  </div>
                ))}
                {org.attendances.length > 0 && org.absentUsers.length > 0 && (
                  <div className="h-px bg-slate-100 my-1.5 mx-2" />
                )}
                {org.absentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg opacity-60">
                    <EntityAvatar name={user.name} fallbackText={user.email} imageUrl={user.photoUrl} size="sm" className="h-7 w-7 border border-slate-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-600 leading-tight truncate">{user.name}</p>
                      <p className="text-[10px] text-red-400 font-medium leading-tight">Not checked in</p>
                    </div>
                  </div>
                ))}
                {org.attendances.length === 0 && org.absentUsers.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">No active users.</div>
                )}
              </div>
            </div>
          )}

          {/* ── Leaves Tab ── */}
          {sidebarTab === 'leaves' && (
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Pending Approvals</span>
                <button onClick={() => fetchDetails()} className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer">
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <div className="overflow-y-auto px-2 pb-2 space-y-2" style={{ maxHeight: '420px' }}>
                {org.leaves.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle2 className="h-7 w-7 mx-auto text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400">All caught up!</p>
                  </div>
                ) : (
                  org.leaves.map((leave) => (
                    <div key={leave.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2">
                          <EntityAvatar name={leave.user.name} fallbackText={leave.user.email} imageUrl={leave.user.photoUrl} size="sm" className="h-7 w-7 border border-slate-200" />
                          <p className="text-xs font-semibold text-slate-900">{leave.user.name}</p>
                        </div>
                        <span className="text-[10px] text-slate-400">{format(new Date(leave.createdAt), 'MMM d')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 mb-1.5 font-medium">
                        <Calendar className="h-3 w-3 text-(--theme)" />
                        {format(new Date(leave.startDate), 'MMM d')} – {format(new Date(leave.endDate), 'MMM d')}
                      </div>
                      {leave.reason && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mb-2 italic">&quot;{leave.reason}&quot;</p>
                      )}
                      {/* An admin can decide Project Assistant leave too now,
                          alongside a Moderator — same action as Faculty leave. */}
                      <div className="flex gap-1.5">
                        <Button size="sm" className="flex-1 h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-2" onClick={() => handleLeaveAction(leave.id, 'APPROVED')} disabled={actioningLeaveId === leave.id}>
                          {actioningLeaveId === leave.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 h-6 text-[11px] border-red-200 text-red-600 hover:bg-red-50 cursor-pointer px-2" onClick={() => handleLeaveAction(leave.id, 'REJECTED')} disabled={actioningLeaveId === leave.id}>
                          {actioningLeaveId === leave.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="h-3 w-3 mr-1" />Reject</>}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Edit Member Dialog ── */}
      <Dialog open={showEditMemberDialog} onOpenChange={setShowEditMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Details</DialogTitle>
            <DialogDescription>Update member details for {editingMember?.name || 'this member'}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateMember} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="memberName">Member Name</Label>
              <Input id="memberName" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberPhoto">Photo</Label>
              <div className="flex items-center gap-3">
                <EntityAvatar name={editFormData.name} fallbackText={editingMember?.email || editingMember?.empCode} imageUrl={editPhotoPreview} className="h-12 w-12 border border-slate-200" />
                <Input id="memberPhoto" type="file" accept="image/*" onChange={handlePhotoChange} />
              </div>
            </div>
            {/* Faculty identity comes from Kerberos — there's nothing here for
                an admin to edit beyond their display name and photo. */}
            {editingMember?.role !== 'FACULTY' && (
              <div className="space-y-2">
                <Label htmlFor="editPhoneNumber">Phone Number (optional)</Label>
                <Input id="editPhoneNumber" value={editFormData.phoneNumber} onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })} />
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" type="button" className="cursor-pointer" onClick={() => setShowEditMemberDialog(false)}>Cancel</Button>
              <Button type="submit" className="text-white cursor-pointer bg-indigo-500 hover:bg-indigo-600" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Status Change Dialog ── */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Status Change
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirmAction?.isActive ? 'activate' : 'deactivate'} this user?{' '}
              {confirmAction?.isActive ? 'They will regain access to the organization.' : 'They will no longer be able to log in.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" className="cursor-pointer" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button className="text-white cursor-pointer" style={{ backgroundColor: 'var(--theme)' }} onClick={confirmToggleStatus}>Confirm Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}