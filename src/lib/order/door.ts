import { GENERIC_DOOR } from "../access.ts";
import { normalizeEmail } from "../member.ts";
import { SEED_PARTNER_INVITES } from "./seed.ts";
import {
  normalizeInviteCode,
  normalizeLicense,
  type PartnerInvite,
  type PartnerSession,
} from "./types.ts";

export function listPartnerInvites(rows: PartnerInvite[] = SEED_PARTNER_INVITES): PartnerInvite[] {
  return rows.map((row) => ({ ...row }));
}

export function findPartnerInvite(
  input: { email: string; inviteCode: string; license: string },
  rows: PartnerInvite[] = SEED_PARTNER_INVITES,
): PartnerInvite | undefined {
  const email = normalizeEmail(input.email);
  const inviteCode = normalizeInviteCode(input.inviteCode);
  const license = normalizeLicense(input.license);
  return rows.find(
    (row) =>
      row.email === email &&
      normalizeInviteCode(row.inviteCode) === inviteCode &&
      normalizeLicense(row.license) === license,
  );
}

export function bindPartnerDoor(
  input: { email: string; inviteCode: string; license: string; age21: boolean },
  rows: PartnerInvite[] = SEED_PARTNER_INVITES,
): { ok: true; session: PartnerSession } | { ok: false; message: string } {
  if (!input.age21) {
    return { ok: false, message: "Please confirm you are 21 and over." };
  }
  const invite = findPartnerInvite(input, rows);
  if (!invite || invite.elevated !== true) {
    return { ok: false, message: GENERIC_DOOR };
  }
  return {
    ok: true,
    session: {
      email: invite.email,
      accountId: invite.accountId,
      license: invite.license,
      inviteCode: invite.inviteCode,
      age21: true,
      role: "partner",
    },
  };
}

export function elevatePartnerInvite(
  license: string,
  rows: PartnerInvite[] = SEED_PARTNER_INVITES,
): { ok: true } | { ok: false; reason: string } {
  const mark = normalizeLicense(license);
  const row = rows.find((item) => normalizeLicense(item.license) === mark);
  if (!row) return { ok: false, reason: "Invite not found." };
  row.elevated = true;
  return { ok: true };
}
