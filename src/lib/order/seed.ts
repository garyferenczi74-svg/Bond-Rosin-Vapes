import { hashPasswordWithSalt } from "./password.ts";
import type { PartnerAccount } from "./types.ts";

export const SEED_PARTNER_PASSWORD = "Bond-Partner-21";
const SEED_SALT = "bond-partner-seed-salt";

function seedAccount(
  email: string,
  license: string,
  accountId: string,
  elevated: boolean,
  profile: {
    dispensaryName: string;
    address: string;
    contactName: string;
    phone: string;
  },
): PartnerAccount {
  const creds = hashPasswordWithSalt(SEED_PARTNER_PASSWORD, SEED_SALT);
  return {
    email,
    license,
    accountId,
    elevated,
    passwordSalt: creds.passwordSalt,
    passwordHash: creds.passwordHash,
    ...profile,
  };
}

export const SEED_PARTNER_ACCOUNTS: PartnerAccount[] = [
  seedAccount("north.buyer@example.test", "MOCK-LIC-PROTO-NORTH", "acct-north", true, {
    dispensaryName: "Prototype Dispensary North",
    address: "100 North Bond Way, Albany, NY 12207",
    contactName: "North Buyer",
    phone: "518-555-0100",
  }),
  seedAccount("lapsed.buyer@example.test", "MOCK-LIC-PROTO-LAPSED", "acct-lapsed", true, {
    dispensaryName: "Prototype Dispensary Lapsed",
    address: "200 South Bond Way, Buffalo, NY 14202",
    contactName: "Lapsed Buyer",
    phone: "716-555-0100",
  }),
  seedAccount("metro.buyer@example.test", "MOCK-LIC-PROTO-METRO", "acct-metro", true, {
    dispensaryName: "Prototype Dispensary Metro",
    address: "300 Metro Bond Way, New York, NY 10013",
    contactName: "Metro Buyer",
    phone: "212-555-0100",
  }),
  seedAccount("west.buyer@example.test", "MOCK-LIC-PROTO-WEST", "acct-west", true, {
    dispensaryName: "Prototype Dispensary West",
    address: "400 West Bond Way, Rochester, NY 14604",
    contactName: "West Buyer",
    phone: "585-555-0100",
  }),
  seedAccount("pending.buyer@example.test", "MOCK-LIC-PROTO-EAST", "acct-east", false, {
    dispensaryName: "Prototype Dispensary East",
    address: "500 East Bond Way, Syracuse, NY 13202",
    contactName: "East Buyer",
    phone: "315-555-0100",
  }),
];

export function clonePartnerAccounts(rows: PartnerAccount[] = SEED_PARTNER_ACCOUNTS): PartnerAccount[] {
  return rows.map((row) => ({ ...row }));
}
