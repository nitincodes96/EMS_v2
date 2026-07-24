export function getDashboardPath(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard"
    case "FACULTY":
      return "/faculty/dashboard"
    case "MODERATOR":
      return "/moderator/dashboard"
    default:
      return "/project-assistant/dashboard"
  }
}
