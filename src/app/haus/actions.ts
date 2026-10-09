"use server";

import { redirect } from "next/navigation";
import { GENERIC_DOOR, PHASE1_MFA_WAIVED, PHASE1_MFA_WAIVER_ID, isAdminRole } from "@/lib/access";
import { writeAudit } from "@/lib/audit";
import { readAdminRow } from "@/lib/gate";
import { recordAuthAttempt } from "@/lib/lockout";
import { admitAtDoor } from "@/lib/haus/door";
import { HausStore } from "@/lib/haus/store";
import { readHausLedger, writeHausLedger } from "@/lib/haus-ledger";
import {
  isDemoMemberEmail,
  memberDestination,
  seedMemberSession,
} from "@/lib/member";
import {
  clearMemberSession,
  readMemberAck,
  writeMemberAck,
  writeMemberSession,
  readMemberSession,
} from "@/lib/member-session";
import { readRequestMeta } from "@/lib/request-meta";
import { hashLockoutValue } from "@/lib/lockout";
import { getSignupStore } from "@/lib/signups";
import { recordHausUpdateOptIn } from "@/lib/signups/haus-updates";

function fail(message = GENERIC_DOOR) {
  return { ok: false as const, message, next: "credentials" as const };
}

async function openMember(email: string): Promise<never> {
  await writeMemberSession(seedMemberSession(email));
  const ack = await readMemberAck();
  redirect(memberDestination(ack, email));
}

async function tryInviteDoor(email: string) {
  const store = new HausStore(await readHausLedger());
  const admitted = admitAtDoor(store, email);
  if (admitted.ok === false) {
    return fail();
  }
  await writeHausLedger(store.snapshot());
  return openMember(email);
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const meta = await readRequestMeta("/haus");

  if (!email || !password) {
    return fail();
  }

  if (isDemoMemberEmail(email)) {
    const pre = await recordAuthAttempt(email, meta.ip, "check");
    if (pre.locked) {
      return fail();
    }
    await recordAuthAttempt(email, meta.ip, "success");
    try {
      const { supabase } = await readAdminRow();
      await supabase.auth.signOut();
    } catch {
      // Demo member mock auth does not depend on Supabase.
    }
    await openMember(email);
  }

  let supabase;
  try {
    ({ supabase } = await readAdminRow());
  } catch {
    return tryInviteDoor(email);
  }

  try {
    const pre = await recordAuthAttempt(email, meta.ip, "check");
    if (pre.locked) {
      return fail();
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      await recordAuthAttempt(email, meta.ip, "fail");
      return tryInviteDoor(email);
    }

    await recordAuthAttempt(email, meta.ip, "success");

    if (isDemoMemberEmail(data.user.email ?? email)) {
      await supabase.auth.signOut();
      await openMember(data.user.email ?? email);
    }

    const { data: adminRow } = await supabase
      .from("admins")
      .select("user_id, role, status, mfa_enrolled")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const admin =
      adminRow && isAdminRole(adminRow.role) && adminRow.status === "active" ? adminRow : null;

    if (!admin) {
      await supabase.auth.signOut();
      return tryInviteDoor(email);
    }

    await clearMemberSession();

    if (PHASE1_MFA_WAIVED) {
      const signedMeta = await readRequestMeta("/haus");
      await writeAudit(supabase, {
        actor: data.user.id,
        action: "admin.sign_in",
        target: "vauxhall",
        before: { aal: "aal1", waiver: PHASE1_MFA_WAIVER_ID },
        after: { aal: "aal1", role: admin.role, mfa: "waived" },
        meta: signedMeta,
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
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return fail();
  }
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

export async function enterHausAction(formData: FormData) {
  const session = await readMemberSession();
  if (!session) {
    redirect("/haus");
  }

  const ack = await readMemberAck();
  const already = ack?.email === session.email && ack.age21;
  const checked = String(formData.get("age21") ?? "") === "1";
  const requestedDispensary = String(formData.get("requestedDispensary") ?? "").trim().replace(/\s+/g, " ");
  if (!already && !checked) {
    return { ok: false as const, message: "Please confirm you are 21 or older. This is a self-attestation." };
  }
  if (!already && requestedDispensary.length < 2) {
    return { ok: false as const, message: "Name the dispensary you are requesting." };
  }

  await writeMemberAck(
    {
      email: session.email,
      welcomeSeen: true,
      age21: true,
    },
    requestedDispensary,
  );
  try {
    await recordHausUpdateOptIn({
      email: session.email,
      source: "haus_door",
      optedIn: String(formData.get("hausUpdates") ?? "") === "1",
      store: getSignupStore(),
    });
  } catch {
    // The product request still stands if the update list cannot be written.
  }
  redirect("/haus/salon");
}

export async function optInHausUpdatesAction(formData: FormData) {
  const session = await readMemberSession();
  if (!session) {
    redirect("/haus");
  }
  const ack = await readMemberAck();
  if (!ack || ack.email !== session.email || !ack.age21) {
    redirect("/haus/welcome");
  }
  const store = getSignupStore();
  const optedIn = String(formData.get("hausUpdates") ?? "") === "1";
  if (!optedIn) {
    const current = await store.hasHausUpdate(session.email);
    if (!current) {
      return { ok: true as const, recorded: false, subscribed: false, message: "" };
    }
    try {
      await store.unsubscribeHausUpdate(hashLockoutValue(session.email));
      return {
        ok: true as const,
        recorded: false,
        subscribed: false,
        message: "Bond Haus updates are off for this email.",
      };
    } catch {
      return {
        ok: false as const,
        recorded: false,
        subscribed: true,
        message: "Bond could not save that opt in.",
      };
    }
  }
  try {
    const result = await recordHausUpdateOptIn({
      email: session.email,
      source: "haus_page",
      optedIn: true,
      store,
    });
    if (result.reason === "suppressed") {
      return {
        ok: false as const,
        recorded: false,
        subscribed: false,
        message: "This email unsubscribed from Bond Haus updates, so Bond will not add it again.",
      };
    }
    if (!result.recorded) {
      return {
        ok: false as const,
        recorded: false,
        subscribed: false,
        message: result.reason === "closed"
          ? "Bond could not save that opt in."
          : "Bond accepts Haus updates only with your 21 or older attestation.",
      };
    }
    return { ok: true as const, recorded: true, subscribed: true, message: "Bond Haus updates are on for this email." };
  } catch {
    return { ok: false as const, recorded: false, subscribed: false, message: "Bond could not save that opt in." };
  }
}

export async function signOutAction() {
  await clearMemberSession();
  try {
    const { supabase } = await readAdminRow();
    await supabase.auth.signOut();
  } catch {
    // Door still closes if Supabase is unavailable.
  }
  redirect("/haus");
}
