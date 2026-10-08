import { readServiceRoleConfig } from "@/lib/supabase/service";
import { MemorySignupStore } from "./memory.ts";
import { RemoteSignupStore } from "./remote.ts";
import type { SignupLedger } from "./types.ts";

export type SignupStore = MemorySignupStore | RemoteSignupStore;

let memory: MemorySignupStore | null = null;

export function signupBackend(): "memory" | "supabase" {
  return readServiceRoleConfig().ok ? "supabase" : "memory";
}

export function getSignupStore(): SignupStore {
  if (signupBackend() === "supabase") return new RemoteSignupStore();
  if (!memory) memory = new MemorySignupStore();
  return memory;
}

export function resetSignupStoreForTests(): MemorySignupStore {
  memory = new MemorySignupStore();
  return memory;
}

export async function readSignupLedger(): Promise<SignupLedger> {
  const store = getSignupStore();
  if (store instanceof MemorySignupStore) return store.ledger();
  return { source: "supabase", dispensaries: [], orders: [], haus: [] };
}
