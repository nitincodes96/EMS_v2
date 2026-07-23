// Dummy work types for PA bookings. Placeholder set until the real taxonomy
// is defined — used by the booking form (dropdown) and validated server-side.
export const WORK_TYPES = [
  "Data Entry",
  "Lab Assistance",
  "Field Work",
  "Documentation",
  "Research Support",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export function isValidWorkType(value: unknown): value is WorkType {
  return typeof value === "string" && (WORK_TYPES as readonly string[]).includes(value);
}
