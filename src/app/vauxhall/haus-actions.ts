"use server";

import { requirePortalSession } from "@/lib/gate";
import { readMemberSession } from "@/lib/member-session";
import { readHausLedger, writeHausLedger } from "@/lib/haus-ledger";
import type { HausPersist, HouseWrite } from "@/lib/haus/types";

export async function readHausLedgerAction(): Promise<HausPersist> {
  await requirePortalSession();
  return readHausLedger();
}

export async function writeHausLedgerAction(snapshot: HausPersist): Promise<HausPersist> {
  const session = await requirePortalSession();
  const current = await readHausLedger();
  const next = session.role === "owner" ? snapshot : { ...snapshot, settings: current.settings };
  return writeHausLedger(next);
}

export async function readPublishedWritesAction(): Promise<HouseWrite[]> {
  const member = await readMemberSession();
  if (member == null) return [];
  const ledger = await readHausLedger();
  return ledger.houseWrites
    .filter((row) => row.state === "published")
    .sort((a, b) => a.order - b.order);
}

export async function readWelcomeTextAction(): Promise<string> {
  const ledger = await readHausLedger();
  return ledger.settings.welcomeText;
}
