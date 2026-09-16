import { PHASE_B_AUTO_ACTIONS_ENABLED } from "./flags.ts";

export const AUTO_ACTION_IDS = ["revoke_credentials", "throttle_forms", "block_source"] as const;
export type AutoActionId = (typeof AUTO_ACTION_IDS)[number];

export type AutoActionItem = {
  id: AutoActionId;
  label: string;
  enabled: false;
  status: "Pending Felix counsel";
  note: string;
};

export const AUTO_ACTION_ALLOWLIST: AutoActionItem[] = [
  {
    id: "revoke_credentials",
    label: "Revoke credentials",
    enabled: PHASE_B_AUTO_ACTIONS_ENABLED,
    status: "Pending Felix counsel",
    note: "Allowlist draft. Toggle stays disabled until Felix and counsel clear.",
  },
  {
    id: "throttle_forms",
    label: "Throttle forms",
    enabled: PHASE_B_AUTO_ACTIONS_ENABLED,
    status: "Pending Felix counsel",
    note: "Allowlist draft. Bond Circle signup throttle stays off.",
  },
  {
    id: "block_source",
    label: "Block source",
    enabled: PHASE_B_AUTO_ACTIONS_ENABLED,
    status: "Pending Felix counsel",
    note: "Allowlist draft. No IP or source block executes.",
  },
];

export function assertAutoActionsOff(items = AUTO_ACTION_ALLOWLIST): void {
  if (items.some((item) => item.enabled)) {
    throw new Error("Auto-actions must stay disabled in Phase B plumbing.");
  }
}

export function executeAutoAction(_id: AutoActionId): { ok: false; executed: false; reason: string } {
  return {
    ok: false,
    executed: false,
    reason: "Auto-action blocked. Live OFF. Pending Felix counsel.",
  };
}
