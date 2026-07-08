export interface Organization {
  id: string
  name: string
  slug?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  photoUrl?: string | null
  phoneNumber?: string | null
  aadharNumber?: string | null
  panNumber?: string | null
  dateOfBirth?: string | null
  resumeUrl?: string | null
  basicSalary?: number | null
  hra?: number | null
  tdsPercent?: number | null
  pfPercent?: number | null
  lopEnabled?: boolean
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
  userType: "EMPLOYEE" | "INTERN" | "CONTRACTUAL"
  isActive: boolean
  status: "INVITED" | "ACCEPTED"
  baseLeaveQuota: number
  extraLeaveQuota: number
  joiningDate?: string | null
  organizationId: string | null
  organization?: Organization | null
  createdAt: string
}
