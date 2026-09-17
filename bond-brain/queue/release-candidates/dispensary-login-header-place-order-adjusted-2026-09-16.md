# RC FINAL: Header Place Order to Dispensary Login

**Requester:** Gary
**Author:** Q
**Date:** 2026-09-17
**Status:** FINAL. JB locks closed. Invite door retired. Part 129 tip pack cited.
**Tip baseline:** PR29 `11c44cd`. B4 HOLD. Do not merge.

## Intent

Replace the Home header Bond Haus tab with Place Order. Destination is Dispensary Login on `/order`. Signed-in partners see the order reservation surface only.

## IN

- Header Place Order (Title Case) to `/order` on desktop and mobile. Part 129 applies.
- Hero ENTER THE BOND HAUS to `/haus` unchanged.
- Logged-out `/order`: Sign up and Sign in tabs. Sign up is dispensary name, address, contact name, phone, OCM number, email, create password plus confirm, 21+. Pending account only.
- Sign in: email plus password. Pending wait. No reservation until ops elevate.
- Elevated `/order`: order reservation surface. Mock license and facility gates stay.
- Invite code field retired.
- Passwords hashed. Never logged in plaintext. Never sent to Metrc.
- Privacy amend covers Dispensary Login.
- Compliance band and licensee identity stay on `/order`.
- `/order` stays noindex. No footer or SKU CTA to `/order`.
- Media HARD LOCK untouched.

## OUT

- Invite code door
- Public unauthenticated order create
- Metrc write / B4 Live ON / Metrc-verified claim
- Haus auth redesign
- Consumer checkout

## Part 129 tip pack

- [x] Header Place Order treated as licensee marketing CTA
- [x] Destination `/order` has 21+ age gate
- [x] No youth-appeal order chrome
- [x] Licensee identity / warnings per Bond Part 129 marketing checklist (OCM-Proc-25-000329 on the compliance band)
- [x] Felix tip Pre-Check named: `/canon/specs/dispensary-login-header-place-order-felix-precheck.md`
- [x] Privacy amend covers dispensary login before first real signup

## Acceptance (once unlocked)

1. Header shows Place Order, not Bond Haus. Hero ENTER THE BOND HAUS unchanged.
2. Place Order opens Dispensary Login at `/order`.
3. Sign up collects dispensary name, address, contact name, phone, OCM number, email, password create plus confirm, and 21+. Account stays pending.
4. Sign in is email plus password. Pending wait. Elevated reservation only. No unauth order create.
5. No Metrc write. No Metrc-verified copy. Haus out of commerce.
6. Cloaks elsewhere unchanged. Tip media HARD LOCK untouched.
7. Vesper PASS + Felix PASS + M VERIFY + Gary go before promote.
