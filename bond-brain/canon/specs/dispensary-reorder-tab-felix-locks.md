# Felix locks: Dispensary reorder tab (Phase A)

**Date:** 2026-09-16 (America/New_York)
**Author:** Felix
**Status:** LOCKED for Phase A shape / verify / notes. Phase B Metrc write remains PARKED with Prompt 2D B.

Amendment 2026-09-17: Header Place Order public CTA and password login are locked by `/canon/specs/dispensary-login-header-place-order.md`. Invite door is retired. Cloak-by-default is no longer absolute for the Home header only.

## Q architecture (accepted)

Metrc order database = Bond Orders (commercial) + Metrc transfer/manifest on fulfill only. No parallel Metrc cart API.

## 1. NY / OCM: self-serve wholesale portal allowed shape

Verdict: CLEAR with required shape (not a ban).

Required Phase A shape:

- Audience: licensed NY adult-use dispensary accounts only
- Surface A: cloaked partner door (`/order`). No public nav/footer CTA. Unauth to door or cloaked 404, never 403
- Auth: invite + license-linked account binding before draft create
- Age: standing 21+ gate
- Commerce: request to Bond Orders draft only. No DTC. No payment capture
- Trace: no Metrc write. No MetrcConnectAdapter. No client Metrc keys
- Do not UI-claim Metrc-verified

## 2. Phase A license verify

Ops/manual elevation + mock Trace gates (reuse Prompt 2D). Live Metrc facility pull is not authorized until 2D Phase B.

## 3. Notes PII

Minimize. No SSN, date of birth, payment card, or government ID prompts. Vauxhall ops only. Never copy notes into Metrc fields.

## Phase B

MetrcConnectAdapter, live keys, transfer draft on fulfill: PARKED with Prompt 2D Phase B.
