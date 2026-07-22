export interface Department {
  id: string
  name: string
  slug?: string
}

export interface User {
  id: string
  email: string | null
  empCode?: string | null
  name: string | null
  photoUrl?: string | null
  phoneNumber?: string | null
  role: "PROJECT_ASSISTANT" | "FACULTY" | "ADMIN"
  isActive: boolean
  status: "INVITED" | "ACCEPTED"
  joiningDate?: string | null
  departmentId: string | null
  department?: Department | null
  createdAt: string
}
