import { findColumn, parseCsv } from "@/lib/csv"

/**
 * Parses the "import Project Assistants" CSV. Expected header (any order,
 * case-insensitive): Email, Name, Phone, Employee Code, Department. Only
 * Email is mandatory; Department may be left blank when the admin picks a
 * default department in the import dialog.
 */

export type PaCsvRow = {
  line: number
  email: string
  name: string
  phoneNumber: string
  empCode: string
  department: string
  error?: string
}

export const PA_CSV_COLUMNS = [
  { name: "Email", required: true, hint: "Login email — the invite is sent here" },
  { name: "Name", required: false, hint: "Full name; defaults to the email's local part" },
  { name: "Phone", required: false, hint: "Contact number" },
  { name: "Employee Code", required: false, hint: "Must be unique if given" },
  { name: "Department", required: false, hint: "Department name; blank = the default picked in the dialog" },
] as const

export const PA_CSV_SAMPLE: string[][] = [
  PA_CSV_COLUMNS.map((c) => c.name),
  ["asha.verma@example.com", "Asha Verma", "9876543210", "PA1001", "Computer Science"],
  ["rohan.k@example.com", "Rohan K", "", "", ""],
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function parsePaCsv(text: string): { rows: PaCsvRow[]; missingEmailColumn: boolean } {
  const { header, rows } = parseCsv(text)
  const iEmail = findColumn(header, "email", "email address", "e-mail")
  const iName = findColumn(header, "name", "full name")
  const iPhone = findColumn(header, "phone", "phone number", "mobile", "contact")
  const iEmp = findColumn(header, "employee code", "emp code", "empcode", "employee id")
  const iDept = findColumn(header, "department", "dept", "department name")

  if (iEmail === -1) return { rows: [], missingEmailColumn: true }

  const seen = new Set<string>()
  const parsed = rows.map((cells, idx): PaCsvRow => {
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "")
    const row: PaCsvRow = {
      line: idx + 2, // 1-based, after the header
      email: get(iEmail).toLowerCase(),
      name: get(iName),
      phoneNumber: get(iPhone),
      empCode: get(iEmp),
      department: get(iDept),
    }
    if (!row.email) row.error = "Missing email"
    else if (!EMAIL.test(row.email)) row.error = "Invalid email"
    else if (seen.has(row.email)) row.error = "Duplicate email in file"
    seen.add(row.email)
    return row
  })

  return { rows: parsed, missingEmailColumn: false }
}
