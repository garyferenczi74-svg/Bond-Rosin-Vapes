export const PARTNER_SKU_IDS = ["no-1", "no-2", "no-3"] as const;
export type PartnerSkuId = (typeof PARTNER_SKU_IDS)[number];

export const PARTNER_SESSION_COOKIE = "bond_order_partner";
export const PARTNER_ACCOUNT_COOKIE = "bond_order_accounts";
export const PARTNER_DRAFT_COOKIE = "bond_order_drafts";
export const PARTNER_DRAFT_STORAGE = "bond_order_drafts";

export const PARTNER_ROLE = "partner" as const;

export type PartnerAccount = {
  email: string;
  license: string;
  accountId: string;
  elevated: boolean;
  passwordSalt: string;
  passwordHash: string;
  dispensaryName: string;
  address: string;
  contactName: string;
  phone: string;
};

export type PartnerSession = {
  email: string;
  accountId: string;
  license: string;
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

export function normalizeLicense(value: string): string {
  return value.trim().toUpperCase();
}

export function isLicenseString(value: string): boolean {
  const license = normalizeLicense(value);
  return license.length >= 4 && /^[A-Z0-9][A-Z0-9-]*$/.test(license);
}

export function normalizeProfileText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isProfileName(value: string): boolean {
  const name = normalizeProfileText(value);
  return name.length >= 2 && name.length <= 80;
}

export function isAddressString(value: string): boolean {
  const address = normalizeProfileText(value);
  return address.length >= 8 && address.length <= 160;
}

export function normalizePhone(value: string): string {
  return value.trim();
}

export function isPhoneString(value: string): boolean {
  const digits = normalizePhone(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function parsePartnerSession(raw: string | null | undefined): PartnerSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PartnerSession>;
    if (!value || typeof value.email !== "string") return null;
    if (typeof value.accountId !== "string" || typeof value.license !== "string") return null;
    if (value.role !== PARTNER_ROLE) return null;
    if (value.age21 !== true) return null;
    return {
      email: value.email.trim().toLowerCase(),
      accountId: value.accountId,
      license: value.license,
      age21: true,
      role: PARTNER_ROLE,
    };
  } catch {
    return null;
  }
}

export function parsePartnerAccounts(raw: string | null | undefined): PartnerAccount[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as { accounts?: unknown };
    const rows = Array.isArray(value.accounts) ? value.accounts : Array.isArray(value) ? value : [];
    return rows
      .filter((row): row is PartnerAccount => {
        if (!row || typeof row !== "object") return false;
        const item = row as Partial<PartnerAccount>;
        return (
          typeof item.email === "string" &&
          typeof item.license === "string" &&
          typeof item.accountId === "string" &&
          typeof item.elevated === "boolean" &&
          typeof item.passwordSalt === "string" &&
          typeof item.passwordHash === "string" &&
          typeof item.dispensaryName === "string" &&
          typeof item.address === "string" &&
          typeof item.contactName === "string" &&
          typeof item.phone === "string"
        );
      })
      .map((row) => ({
        email: row.email.trim().toLowerCase(),
        license: normalizeLicense(row.license),
        accountId: row.accountId,
        elevated: row.elevated === true,
        passwordSalt: row.passwordSalt,
        passwordHash: row.passwordHash,
        dispensaryName: normalizeProfileText(row.dispensaryName),
        address: normalizeProfileText(row.address),
        contactName: normalizeProfileText(row.contactName),
        phone: normalizePhone(row.phone),
      }));
  } catch {
    return [];
  }
}

export function serializePartnerAccounts(rows: PartnerAccount[]): string {
  return JSON.stringify({
    accounts: rows.slice(0, 48).map((row) => ({
      email: row.email,
      license: row.license,
      accountId: row.accountId,
      elevated: row.elevated,
      passwordSalt: row.passwordSalt,
      passwordHash: row.passwordHash,
      dispensaryName: row.dispensaryName,
      address: row.address,
      contactName: row.contactName,
      phone: row.phone,
    })),
  });
}
