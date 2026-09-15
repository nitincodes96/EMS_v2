/**
 * Minimal CSV reader for the admin import screens. Handles quoted fields
 * (including embedded commas and doubled quotes) and CRLF line endings, and
 * returns the header row separately so callers can match columns by name.
 */
export function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
  if (lines.length === 0) return { header: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const out: string[] = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ",") {
        out.push(cur)
        cur = ""
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out.map((s) => s.trim())
  }

  const [headerLine, ...dataLines] = lines
  return { header: parseLine(headerLine), rows: dataLines.map(parseLine) }
}

/** Case/space-insensitive column lookup: "Employee Code", "emp_code", "EmpCode" all match. */
export function findColumn(header: string[], ...aliases: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
  const wanted = aliases.map(norm)
  return header.findIndex((h) => wanted.includes(norm(h)))
}

/** Build a CSV string from rows, quoting anything that needs it. */
export function toCsv(rows: string[][]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n"
}

/** Trigger a browser download of a text file. */
export function downloadTextFile(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
