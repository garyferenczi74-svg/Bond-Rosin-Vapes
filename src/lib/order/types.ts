export const PARTNER_SKU_IDS = ["no-1", "no-2", "no-3"] as const;
export type PartnerSkuId = (typeof PARTNER_SKU_IDS)[number];

export const PARTNER_SESSION_COOKIE = "bond_order_partner";
export const PARTNER_DRAFT_COOKIE = "bond_order_drafts";
export const PARTNER_DRAFT_STORAGE = "bond_order_drafts";

export const PARTNER_ROLE = "partner" as const;

export type PartnerInvite = {
  email: string;
  inviteCode: string;
  license: string;
  accountId: string;
  elevated: boolean;
};

export type PartnerSession = {
  email: string;
  accountId: string;
  license: string;
  inviteCode: string;
  age21: true;
  role: typeof PARTNER_ROLE;
};

export type PartnerDraftBundle = {
  orders: Array<{
    id: string;
    accountId: string;
    stage: "draft";
    promisedOn: string;
    late: boolean;
    manifestNumber: string;
    lines: Array<{
      skuId: string;
      format: string;
      qty: number;
      batchLabel: string;
      lotId?: string;
      metrcUid?: string;
    }>;
    documents: string;
    notes?: string;
    source?: "partner";
  }>;
  events: Array<{
    id: string;
    time: string;
    agent: "Q";
    type: "ORDER_REQUEST";
    summary: string;
    sub: string;
    audit: string;
  }>;
};

export function isPartnerSkuId(value: string): value is PartnerSkuId {
  return (PARTNER_SKU_IDS as readonly string[]).includes(value);
}

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeLicense(value: string): string {
  return value.trim().toUpperCase();
}

export function parsePartnerSession(raw: string | null | undefined): PartnerSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PartnerSession>;
    if (!value || typeof value.email !== "string") return null;
    if (typeof value.accountId !== "string" || typeof value.license !== "string") return null;
    if (typeof value.inviteCode !== "string") return null;
    if (value.role !== PARTNER_ROLE) return null;
    if (value.age21 !== true) return null;
    return {
      email: value.email.trim().toLowerCase(),
      accountId: value.accountId,
      license: value.license,
      inviteCode: value.inviteCode,
      age21: true,
      role: PARTNER_ROLE,
    };
  } catch {
    return null;
  }
}
