import type { PartnerInvite } from "./types.ts";

export const SEED_PARTNER_INVITES: PartnerInvite[] = [
  {
    email: "north.buyer@example.test",
    inviteCode: "MOCK-INVITE-NORTH",
    license: "MOCK-LIC-PROTO-NORTH",
    accountId: "acct-north",
    elevated: true,
  },
  {
    email: "lapsed.buyer@example.test",
    inviteCode: "MOCK-INVITE-LAPSED",
    license: "MOCK-LIC-PROTO-LAPSED",
    accountId: "acct-lapsed",
    elevated: true,
  },
  {
    email: "metro.buyer@example.test",
    inviteCode: "MOCK-INVITE-METRO",
    license: "MOCK-LIC-PROTO-METRO",
    accountId: "acct-metro",
    elevated: true,
  },
  {
    email: "west.buyer@example.test",
    inviteCode: "MOCK-INVITE-WEST",
    license: "MOCK-LIC-PROTO-WEST",
    accountId: "acct-west",
    elevated: true,
  },
  {
    email: "pending.buyer@example.test",
    inviteCode: "MOCK-INVITE-PENDING",
    license: "MOCK-LIC-PROTO-EAST",
    accountId: "acct-east",
    elevated: false,
  },
];
