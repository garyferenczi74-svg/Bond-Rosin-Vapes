import { cookies } from "next/headers";
import { parseHausPersist, serializeHausPersist } from "@/lib/haus/persist";
import { HAUS_LEDGER_COOKIE, type HausPersist } from "@/lib/haus/types";

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function readHausLedger(): Promise<HausPersist> {
  const store = await cookies();
  return parseHausPersist(store.get(HAUS_LEDGER_COOKIE)?.value);
}

export async function writeHausLedger(data: HausPersist): Promise<HausPersist> {
  const parsed = parseHausPersist(serializeHausPersist(data));
  const store = await cookies();
  store.set(HAUS_LEDGER_COOKIE, serializeHausPersist(parsed), {
    ...cookieBase(),
    maxAge: 60 * 60 * 24 * 30,
  });
  return parsed;
}
