export function saveRegistrationDraft(data: Record<string, any>) {
  if (typeof window === "undefined") return;
  const existing = getRegistrationDraft();
  localStorage.setItem("registration_draft", JSON.stringify({ ...existing, ...data }));
}

export function getRegistrationDraft() {
  if (typeof window === "undefined") return {};
  const data = localStorage.getItem("registration_draft");
  return data ? JSON.parse(data) : {};
}

export function clearRegistrationDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("registration_draft");
}
