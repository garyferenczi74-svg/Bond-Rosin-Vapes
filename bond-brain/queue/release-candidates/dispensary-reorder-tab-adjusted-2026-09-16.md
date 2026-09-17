# RC: Dispensary reorder tab. Bond Orders. Phase A FINAL

**Requester:** Gary
**Author:** Q
**Date:** 2026-09-16
**Status:** FINAL. Surface A `/order`. Auth license-linked invite. Phase A only. Phase B PARKED.

Tip baseline: PR26 sha `cd018742`

## Phase A IN

- Cloaked `/order` partner door. No public CTA. Unauth to door, never 403
- Invite + license binding before draft create. Standing 21+ gate
- Ops/manual elevation + mock Trace facility/license gates
- Submit creates Bond Orders draft only. Live Feed `ORDER_REQUEST`
- SKUs: Dialed / Unwind / Peak
- Named gates: License gate (expired), Facility gate (inactive)
- Notes PII minimized. Never copied into Metrc fields
- No Metrc write. No MetrcConnectAdapter. No Metrc-verified claim

## Phase A OUT

- MetrcConnectAdapter / live keys / createTransferDraft on fulfill
- Payment capture / DTC / Haus commerce
- Public marketing CTA to `/order`
- Media binary changes
