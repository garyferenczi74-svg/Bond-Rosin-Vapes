export const PHASE_B_EXECUTION_MODE = "dry-run" as const;
export const PHASE_B_LIVE_ENABLED = false;
export const PHASE_B_PAGING_ENABLED = false;
export const PHASE_B_AUTO_ACTIONS_ENABLED = false;
export const PHASE_B_HARD_SHIP_GATE = false;

export const PHASE_B_ROLLBACK_DEPLOYMENT = "dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9";

export const DRY_RUN_BADGE = "Dry-run";
export const LIVE_OFF_BADGE = "Live OFF";

export function isLivePagingBlocked(): true {
  return true;
}

export function isAutoActionBlocked(): true {
  return true;
}
