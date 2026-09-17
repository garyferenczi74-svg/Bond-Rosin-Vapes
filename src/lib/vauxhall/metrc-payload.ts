import type { TraceTransferDraftInput } from "./trace.ts";

const FORBIDDEN_KEY = /^(notes?|comment|memo|message|remark)$/i;

export type RegulatoryTransferFields = {
  orderId: string;
  fromFacilityId: string;
  toFacilityId: string;
  destinationLicense?: string;
  packages: Array<{ label: string; quantity: number }>;
};

export function regulatoryTransferFields(input: TraceTransferDraftInput): RegulatoryTransferFields {
  return {
    orderId: input.orderId,
    fromFacilityId: input.fromFacilityId,
    toFacilityId: input.toFacilityId,
    destinationLicense: input.destinationLicense?.trim() || undefined,
    packages: (input.packages ?? [])
      .map((row) => ({
        label: String(row.label ?? "").trim(),
        quantity: Number(row.quantity),
      }))
      .filter((row) => row.label && Number.isFinite(row.quantity) && row.quantity > 0),
  };
}

export function payloadHasForbiddenNotes(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((item) => payloadHasForbiddenNotes(item));
  if (typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) return true;
    if (payloadHasForbiddenNotes(child)) return true;
  }
  return false;
}
