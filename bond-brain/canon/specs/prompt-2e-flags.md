# Prompt 2E flags

Owner: Felix + M
Status: Phase B plumbing. All live flags off.
Filed: 2026-09-16

| Flag | Value | Note |
| --- | --- | --- |
| Execution mode | dry-run | Production MonitorRunner default |
| Live probes | OFF | Two-region contracts only |
| Paging | OFF | No phone, SMS, email, or webhook |
| Auto-actions | OFF | Allowlist draft. Pending Felix counsel |
| Scan-on-commit merge block | OFF | Follow-on enablement |
| M ship precondition | advisory | Hard gate waits for M enablement |
| Tamper Test | Demo only | Production audit_events never uses it |
| MetrcConnectAdapter | OUT | Trace mock / Phase A seam only |
| Social publish / Scheduler unpark | OUT | Prompt 2C stays parked |

Rollback candidate for any production promote of this stream: `dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9` (PR15 live tip).
