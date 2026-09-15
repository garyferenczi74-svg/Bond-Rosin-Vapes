import { notFound } from "next/navigation";
import { adminPortalAllowed, isAdminRole, type AdminRow } from "@/lib/access";
import { createSupabaseServer } from "@/lib/supabase/server";

export type PortalSession = {
  userId: string;
  email: string | null;
  role: AdminRow["role"];
};

export async function readAdminRow() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, admin: null as AdminRow | null };
  }

  const { data } = await supabase
    .from("admins")
    .select("user_id, role, status, mfa_enrolled")
    .eq("user_id", user.id)
    .maybeSingle();

  const admin =
    data && isAdminRole(data.role) && data.status === "active"
      ? (data as AdminRow)
      : null;

  return { supabase, user, admin };
}

export async function requirePortalSession(): Promise<PortalSession> {
  const { user, admin } = await readAdminRow();
  if (!user || !admin) {
    notFound();
  }

  if (!adminPortalAllowed({ admin })) {
    notFound();
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: admin.role,
  };
}
