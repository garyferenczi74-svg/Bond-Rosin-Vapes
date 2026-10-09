import { readServiceRoleConfig } from "@/lib/supabase/service";
import { MemorySignupStore } from "./memory.ts";
import { RemoteSignupStore } from "./remote.ts";
import type { SignupLedger } from "./types.ts";

export type SignupStore = MemorySignupStore | RemoteSignupStore;

// Next dev bundles the page and the server actions apart. One process-wide store
// keeps a session written by an action visible to the next render.
const memoryGlobal = globalThis as typeof globalThis & {
  __bondSignupMemory?: MemorySignupStore;
};

export function signupBackend(): "memory" | "supabase" {
  return readServiceRoleConfig().ok ? "supabase" : "memory";
}

export function getSignupStore(): SignupStore {
  if (signupBackend() === "supabase") return new RemoteSignupStore();
  if (!memoryGlobal.__bondSignupMemory) memoryGlobal.__bondSignupMemory = new MemorySignupStore();
  return memoryGlobal.__bondSignupMemory;
}

export function resetSignupStoreForTests(): MemorySignupStore {
  const next = new MemorySignupStore();
  memoryGlobal.__bondSignupMemory = next;
  return next;
}

export async function readSignupLedger(): Promise<SignupLedger> {
  const store = getSignupStore();
  if (store instanceof MemorySignupStore) return store.ledger();
  return { source: "supabase", dispensaries: [], orders: [], haus: [], updates: [] };
}
