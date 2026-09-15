import type { AdminRole } from "@/lib/tokens";

export const IDLE_MS = 24 * 60 * 60 * 1000;
export const IDLE_COOKIE = "bond_idle_at";

export type AdminRow = {
  user_id: string;
  role: AdminRole;
  status: string;
  mfa_enrolled: boolean;
};

export function isAdminRole(value: string | null | undefined): value is AdminRole {
  return value === "owner" || value === "operator";
}

export function isIdleExpired(lastActiveMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(lastActiveMs) || lastActiveMs <= 0) return false;
  return now - lastActiveMs > IDLE_MS;
}

export function adminPortalAllowed(input: {
  admin: Pick<AdminRow, "role" | "status"> | null;
  aal: string | null | undefined;
  verifiedFactorCount: number;
}): boolean {
  if (!input.admin) return false;
  if (input.admin.status !== "active") return false;
  if (!isAdminRole(input.admin.role)) return false;
  if (input.aal !== "aal2") return false;
  if (input.verifiedFactorCount < 1) return false;
  return true;
}

export const CLOAKED_STATIC_PATHS = [
  "/Admin.dc.html",
  "/Vauxhall.dc.html",
  "/HausAdmin.dc.html",
  "/Product.dc.html",
  "/Security.dc.html",
  "/Social.dc.html",
] as const;

export function isCloakedStaticPath(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return (CLOAKED_STATIC_PATHS as readonly string[]).includes(path);
}

export const GENERIC_DOOR = "That did not open the door.";
