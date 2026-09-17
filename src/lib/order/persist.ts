import type { AgentEvent, WholesaleOrder } from "../vauxhall/types.ts";
import { PARTNER_DRAFT_STORAGE, type PartnerDraftBundle } from "./types.ts";

export function emptyPartnerDraftBundle(): PartnerDraftBundle {
  return { orders: [], events: [] };
}

export function parsePartnerDraftBundle(raw: string | null | undefined): PartnerDraftBundle {
  if (!raw) return emptyPartnerDraftBundle();
  try {
    const value = JSON.parse(raw) as Partial<PartnerDraftBundle>;
    const orders = Array.isArray(value.orders) ? value.orders : [];
    const events = Array.isArray(value.events) ? value.events : [];
    return {
      orders: orders
        .filter((order) => order && typeof order.id === "string" && order.stage === "draft")
        .map((order) => ({
          ...order,
          stage: "draft" as const,
          source: "partner" as const,
          lines: Array.isArray(order.lines) ? order.lines.map((line) => ({ ...line })) : [],
        })),
      events: events
        .filter((event) => event && typeof event.id === "string" && event.type === "ORDER_REQUEST")
        .map((event) => ({
          ...event,
          agent: "Q" as const,
          type: "ORDER_REQUEST" as const,
        })),
    };
  } catch {
    return emptyPartnerDraftBundle();
  }
}

export function serializePartnerDraftBundle(bundle: PartnerDraftBundle): string {
  return JSON.stringify({
    orders: bundle.orders.slice(0, 24),
    events: bundle.events.slice(0, 24),
  });
}

export function mergePartnerDraftBundle(
  current: PartnerDraftBundle,
  incoming: PartnerDraftBundle,
): PartnerDraftBundle {
  const orders = [...incoming.orders];
  for (const order of current.orders) {
    if (!orders.some((row) => row.id === order.id)) orders.push(order);
  }
  const events = [...incoming.events];
  for (const event of current.events) {
    if (!events.some((row) => row.id === event.id)) events.push(event);
  }
  return { orders, events };
}

export function bundleFromStoreParts(input: {
  order: WholesaleOrder;
  event: AgentEvent;
}): PartnerDraftBundle {
  return {
    orders: [
      {
        id: input.order.id,
        accountId: input.order.accountId,
        stage: "draft",
        promisedOn: input.order.promisedOn,
        late: input.order.late,
        manifestNumber: input.order.manifestNumber,
        lines: input.order.lines.map((line) => ({ ...line })),
        documents: input.order.documents,
        notes: input.order.notes,
        source: "partner",
      },
    ],
    events: [
      {
        id: input.event.id,
        time: input.event.time,
        agent: "Q",
        type: "ORDER_REQUEST",
        summary: input.event.summary,
        sub: input.event.sub,
        audit: input.event.audit,
      },
    ],
  };
}

export function readLocalPartnerDrafts(): PartnerDraftBundle {
  if (typeof window === "undefined") return emptyPartnerDraftBundle();
  try {
    return parsePartnerDraftBundle(window.localStorage.getItem(PARTNER_DRAFT_STORAGE));
  } catch {
    return emptyPartnerDraftBundle();
  }
}

export function writeLocalPartnerDrafts(bundle: PartnerDraftBundle): void {
  if (typeof window === "undefined") return;
  try {
    const merged = mergePartnerDraftBundle(readLocalPartnerDrafts(), bundle);
    window.localStorage.setItem(PARTNER_DRAFT_STORAGE, serializePartnerDraftBundle(merged));
  } catch {
    // Browser persist is optional for the mock book.
  }
}
