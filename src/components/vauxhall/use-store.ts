"use client";

import { useSyncExternalStore } from "react";
import { getVauxhallStore } from "@/lib/vauxhall/store";

export function useVauxhallStore() {
  const store = getVauxhallStore();
  useSyncExternalStore(store.subscribe, () => store.revision, () => store.revision);
  return store;
}
