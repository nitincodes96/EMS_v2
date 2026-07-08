import { randomBytes } from "crypto"

const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function generateInviteToken(): { token: string; expiry: Date } {
  return {
    token: randomBytes(32).toString("hex"),
    expiry: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
  }
}
