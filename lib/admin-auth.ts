import { env } from "cloudflare:workers";

export function isAdminEmail(email: string) {
  return (env.ADMIN_EMAIL || "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
