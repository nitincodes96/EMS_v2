export type HolidayCsvRow = {
  name: string
  date: string
  type: "CUSTOM" | "RELIGIOUS" | "NATIONAL"
  error?: string
}

const VALID_TYPES = ["CUSTOM", "RELIGIOUS", "NATIONAL"]

export function parseHolidayCsv(text: string): HolidayCsvRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const [, ...dataLines] = lines // skip header row: Date, Holiday Name, Holiday Type

  return dataLines.map((line) => {
    const [dateRaw = "", nameRaw = "", typeRaw = ""] = line.split(",").map((s) => s.trim())
    const typeUpper = typeRaw.toUpperCase()
    const validType = VALID_TYPES.includes(typeUpper)
    const parsedDate = new Date(dateRaw)
    const validDate = dateRaw !== "" && !isNaN(parsedDate.getTime())

    let error: string | undefined
    if (!nameRaw) error = "Missing holiday name"
    else if (!validDate) error = "Invalid date"
    else if (!validType) error = "Unrecognized type"

    return {
      name: nameRaw,
      date: validDate ? parsedDate.toISOString().split("T")[0] : dateRaw,
      type: (validType ? typeUpper : "CUSTOM") as HolidayCsvRow["type"],
      error,
    }
  })
}
