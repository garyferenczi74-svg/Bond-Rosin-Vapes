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

// Waiver W-2026-09-15-P1-OVERRIDE. Password-only admin entry for Phase 1.
// MFA enroll and AAL2 are not required. Restore MFA by setting this false
// and putting the AAL2 checks back in is_admin().
export const PHASE1_MFA_WAIVED = true;
export const PHASE1_MFA_WAIVER_ID = "W-2026-09-15-P1-OVERRIDE";

export function adminPortalAllowed(input: {
  admin: Pick<AdminRow, "role" | "status"> | null;
  aal?: string | null;
  verifiedFactorCount?: number;
}): boolean {
  if (!input.admin) return false;
  if (input.admin.status !== "active") return false;
  if (!isAdminRole(input.admin.role)) return false;
  if (PHASE1_MFA_WAIVED) return true;
  if (input.aal !== "aal2") return false;
  if ((input.verifiedFactorCount ?? 0) < 1) return false;
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
