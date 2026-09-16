"use client";

import { useEffect, useSyncExternalStore } from "react";
import { readHausLedgerAction, writeHausLedgerAction } from "@/app/vauxhall/haus-actions";
import { getHausStore, type HausStore } from "@/lib/haus/store";

export function useHausStore(): HausStore {
  const store = getHausStore();
  useSyncExternalStore(store.subscribe, () => store.revision, () => store.revision);
  return store;
}

export function useHausLedger(store: HausStore): void {
  useEffect(() => {
    let cancelled = false;
    readHausLedgerAction().then((snap) => {
      if (cancelled) return;
      store.hydrate(snap);
    });
    return () => {
      cancelled = true;
    };
  }, [store]);
}

export async function persistHausStore(store: HausStore): Promise<void> {
  const next = await writeHausLedgerAction(store.snapshot());
  store.hydrate(next);
}
