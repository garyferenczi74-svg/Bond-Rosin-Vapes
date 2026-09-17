# Felix Pre-Check: Header Place Order to Dispensary Login

**Date:** 2026-09-16 (America/New_York)
**RC:** `/queue/release-candidates/dispensary-login-header-place-order-adjusted-2026-09-16.md`
**Tip baseline:** PR28
**Verdict:** CONDITIONAL CLEAR under JB FINAL locks. Named tip Pre-Check required before M ship.

## A. Public Header CTA

CONDITIONAL CLEAR. Part 129 tip pack required. Header Place Order may point at `/order`. Hero ENTER THE BOND HAUS stays. No footer spam of `/order`. No unauthenticated order create.

## B. Self-serve password

CLEAR only as a pending account until ops elevate. Password create must not grant draft-submit rights. Invite door is retired.

## C. OCM number and credentials

OCM number is the NY OCM adult-use license number. Hash passwords. Never log plaintext. Never send to Metrc. No Metrc-verified claim. Privacy must cover Dispensary Login before first real signup.

## D. Part 129

YES. Header Place Order is licensee marketing. Destination `/order` needs a 21+ age gate, no youth-appeal chrome, and standing Bond identity / warning pack (OCM-Proc-25-000329). FAIL tip without the age gate.

## OUT

Metrc write / B4 Live ON. Consumer checkout. Haus auth redesign.
