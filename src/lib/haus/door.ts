import { daysUntil } from "./dates.ts";
import type { HausStore } from "./store.ts";
import { isDemoMemberEmail, normalizeEmail } from "../member.ts";

export function canAdmitAtDoor(store: HausStore, email: string): { ok: boolean } {
  const norm = normalizeEmail(email);
  if (isDemoMemberEmail(norm)) return { ok: true };

  const account = store.data.accounts.find((row) => row.email === norm);
  if (account && account.state === "active") return { ok: true };

  const invite = store.data.invitations.find((row) => row.email === norm);
  if (invite && invite.state === "accepted") return { ok: true };

  store.expireIfNeeded(norm);
  const current = store.data.invitations.find((row) => row.email === norm);
  if (current == null || current.state !== "issued") return { ok: false };

  if (store.data.settings.registrationPause) return { ok: false };
  if (store.data.settings.invitationWindow === false) return { ok: false };
  if (daysUntil(current.expires) < 0) return { ok: false };

  return { ok: true };
}

export function admitAtDoor(store: HausStore, email: string): { ok: boolean } {
  const check = canAdmitAtDoor(store, email);
  if (check.ok === false) return { ok: false };
  if (isDemoMemberEmail(email)) return { ok: true };

  const norm = normalizeEmail(email);
  const account = store.data.accounts.find((row) => row.email === norm);
  if (account && account.state === "active") return { ok: true };
  const invite = store.data.invitations.find((row) => row.email === norm);
  if (invite && invite.state === "accepted") return { ok: true };
  return store.acceptInvitation(norm);
}
