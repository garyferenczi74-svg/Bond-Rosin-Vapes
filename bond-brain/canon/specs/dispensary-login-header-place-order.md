# Spec: Header Place Order and Dispensary Login (Phase A)

**Date:** 2026-09-17
**Status:** JB FINAL
**Tip baseline:** PR28 `33f502f`

## Locks

1. Header Bond Haus becomes Place Order (Title Case). href `/order`. Part 129 applies.
2. Hero ENTER THE BOND HAUS stays on `/haus`. Haus stays out of commerce.
3. Logged-out `/order` is Dispensary Login: email, NY OCM license number, create password plus confirm, 21+. Creates a pending account only. Ops elevate before any reservation submit. Invite code field is retired.
4. Signed-in `/order` is the order reservation surface only. No unauthenticated order create.
5. No Metrc write. No Metrc-verified claim. B4 HOLD.
6. Password hashed. Never log plaintext. Never send to Metrc.
7. Destination age gate 21+. No youth appeal. Keep Bond compliance chrome and warnings.
8. Media HARD LOCK untouched.

## Out

- Invite code door
- Public unauthenticated order create
- Metrc Live ON
- Haus auth redesign
- Consumer checkout
