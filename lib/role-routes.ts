export function getDashboardPath(role?: string | null): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard"
    case "ADMIN":
      return "/admin/dashboard"
    default:
      return "/user/dashboard"
  }
}
