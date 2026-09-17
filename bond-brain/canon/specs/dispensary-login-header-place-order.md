# Spec: Header Place Order and Dispensary Login (Phase A)

**Date:** 2026-09-17
**Status:** JB FINAL
**Tip baseline:** PR29 `11c44cd`

## Locks

1. Header Bond Haus becomes Place Order (Title Case). href `/order`. Part 129 applies.
2. Hero ENTER THE BOND HAUS stays on `/haus`. Haus stays out of commerce.
3. Logged-out `/order` is Dispensary Login with two tabs: Sign up and Sign in. Invite code field is retired.
4. Sign up collects dispensary name, address, contact name, phone, OCM number, email, create password, confirm password, and 21+. Primary CTA is Continue. Secondary is Already registered? Sign in. Creates a pending account only. Ops elevate before reservation access.
5. Sign in is email plus password only. Primary CTA is Sign in. Elevated session opens the reservation surface. Pending session shows: This account is pending. Bond operations must elevate it before a reservation can be filed.
6. No unauthenticated order create. No Metrc write. No Metrc-verified claim. B4 HOLD.
7. Password hashed. Never log plaintext. Never send to Metrc.
8. Destination age gate 21+ on Sign up. No youth appeal. Keep Bond compliance chrome and warnings.
9. Media HARD LOCK untouched.

## Out

- Invite code door
- Public unauthenticated order create
- Metrc Live ON
- Haus auth redesign
- Consumer checkout
