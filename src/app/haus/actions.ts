"use server";

import { redirect } from "next/navigation";
import { GENERIC_DOOR, PHASE1_MFA_WAIVED, PHASE1_MFA_WAIVER_ID, isAdminRole } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { readAdminRow } from "@/lib/gate";
import { recordAuthAttempt } from "@/lib/lockout";
import { readRequestMeta } from "@/lib/request-meta";

function fail(message = GENERIC_DOOR) {
  return { ok: false as const, message, next: "credentials" as const };
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const meta = await readRequestMeta("/haus");

  if (!email || !password) {
    return fail();
  }

  const { supabase } = await readAdminRow();
  const pre = await recordAuthAttempt(supabase, email, meta.ip, "check");
  if (pre.locked) {
    return fail();
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await recordAuthAttempt(supabase, email, meta.ip, "fail");
    return fail();
  }

  await recordAuthAttempt(supabase, email, meta.ip, "success");

  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id, role, status, mfa_enrolled")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const admin =
    adminRow && isAdminRole(adminRow.role) && adminRow.status === "active" ? adminRow : null;

  if (!admin) {
    return { ok: true as const, next: "member" as const };
  }

  if (PHASE1_MFA_WAIVED) {
    const meta = await readRequestMeta("/haus");
    await writeAudit(supabase, {
      actor: data.user.id,
      action: "admin.sign_in",
      target: "vauxhall",
      before: { aal: "aal1", waiver: PHASE1_MFA_WAIVER_ID },
      after: { aal: "aal1", role: admin.role, mfa: "waived" },
      meta,
    });
    redirect("/vauxhall");
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");
  const unverified = (factors?.totp ?? []).filter((f) => f.status !== "verified");

  if (verified.length === 0) {
    if (unverified[0]) {
      return {
        ok: true as const,
        next: "mfa-enroll" as const,
        factorId: unverified[0].id,
        qr: null as string | null,
      };
    }
    const enrolled = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Bond Haus",
    });
    if (enrolled.error || !enrolled.data) {
      await supabase.auth.signOut();
      return fail("Authenticator setup failed. Access stays closed.");
    }
    return {
      ok: true as const,
      next: "mfa-enroll" as const,
      factorId: enrolled.data.id,
      qr: enrolled.data.totp.qr_code,
    };
  }

  const challenge = await supabase.auth.mfa.challenge({ factorId: verified[0].id });
  if (challenge.error || !challenge.data) {
    return fail();
  }

  return {
    ok: true as const,
    next: "mfa-challenge" as const,
    factorId: verified[0].id,
    challengeId: challenge.data.id,
  };
}

export async function verifyMfaAction(formData: FormData) {
  const factorId = String(formData.get("factorId") ?? "");
  const challengeIdIn = String(formData.get("challengeId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  const enroll = String(formData.get("enroll") ?? "") === "1";

  if (!factorId || !code) {
    return fail();
  }

  const { supabase, user, admin } = await readAdminRow();
  if (!user || !admin) {
    await supabase.auth.signOut();
    return fail();
  }

  let challengeId = challengeIdIn;
  if (!challengeId) {
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      return fail();
    }
    challengeId = challenge.data.id;
  }

  const verified = await supabase.auth.mfa.verify({ factorId, challengeId, code });
  if (verified.error) {
    return fail();
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedCount = (factors?.totp ?? []).filter((f) => f.status === "verified").length;

  if (aal?.currentLevel !== "aal2" || verifiedCount < 1) {
    await supabase.auth.signOut();
    return fail("Authenticator required. Access stays closed.");
  }

  if (enroll) {
    await supabase.rpc("mark_admin_mfa_enrolled");
  }

  const meta = await readRequestMeta("/haus");
  await writeAudit(supabase, {
    actor: user.id,
    action: enroll ? "admin.mfa_enroll" : "admin.sign_in",
    target: "vauxhall",
    before: { aal: "aal1" },
    after: { aal: "aal2", role: admin.role },
    meta,
  });

  redirect("/vauxhall");
}

export async function signOutAction() {
  const { supabase } = await readAdminRow();
  await supabase.auth.signOut();
  redirect("/haus");
}
