# Prompt 2E Phase B plumbing

Owner: Q
Status: Plumbing dry-run only
Depends on: PR14 Phase A plus PR15 Haus cloak (`dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9`)
Filed: 2026-09-16

## What this PR adds

- `monitor_schedules` for the fourteen-monitor catalog. Cadence is data.
- Dry-run MonitorRunner. Writes run records and findings drafts. No external synthetics.
- Two-region probe contracts. Interfaces and config only.
- `audit_events` append-only hash chain, verify stub, off-site checkpoint stub.
- Scanner ingest stub for CI scan JSON into findings drafts.
- Pre-Check server dry-run. Metrc freshness from Trace mock only.
- UI badges: Dry-run / Live OFF on Monitors, Pre-Check server path, and Auto-actions.
- Auto-actions panel. Allowlist draft. Pending Felix counsel. All toggles disabled.
- M ship precondition named on Queue and Pre-Check. Advisory until M enablement.
- Vesper weekly monitor audit named as a Security route and a Queue item.
- Carries PR15 Haus.dc.html cloak (SHA 49b3e78). Unauthenticated /Haus.dc.html stays 404.

## What this PR does not add

- Live phone paging, SMS, email, or webhook
- Credential revoke, form throttle, or source block
- Two-region live probes against production
- MetrcConnectAdapter
- Social publish or Scheduler unpark

## Promote note

Felix PASS + Vesper PASS + M PASS required before promote.
Production promote names rollback `dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9`.
