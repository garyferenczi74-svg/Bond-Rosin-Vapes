import { hashPasswordWithSalt } from "./password.ts";
import type { PartnerAccount } from "./types.ts";

export const SEED_PARTNER_PASSWORD = "Bond-Partner-21";
const SEED_SALT = "bond-partner-seed-salt";

function seedAccount(
  email: string,
  license: string,
  accountId: string,
  elevated: boolean,
): PartnerAccount {
  const creds = hashPasswordWithSalt(SEED_PARTNER_PASSWORD, SEED_SALT);
  return {
    email,
    license,
    accountId,
    elevated,
    passwordSalt: creds.passwordSalt,
    passwordHash: creds.passwordHash,
  };
}

export const SEED_PARTNER_ACCOUNTS: PartnerAccount[] = [
  seedAccount("north.buyer@example.test", "MOCK-LIC-PROTO-NORTH", "acct-north", true),
  seedAccount("lapsed.buyer@example.test", "MOCK-LIC-PROTO-LAPSED", "acct-lapsed", true),
  seedAccount("metro.buyer@example.test", "MOCK-LIC-PROTO-METRO", "acct-metro", true),
  seedAccount("west.buyer@example.test", "MOCK-LIC-PROTO-WEST", "acct-west", true),
  seedAccount("pending.buyer@example.test", "MOCK-LIC-PROTO-EAST", "acct-east", false),
];

export function clonePartnerAccounts(rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS): PartnerAccount[] {
  return rows.map((row) => ({ ...row }));
}
