# Waiver W-2026-09-15-P1-OVERRIDE

Date: 2026-09-15
Owner: Gary
Scope: Bond-Rosin-Vapes Phase 1 access shell
Status: Active

## What is waived

1. P1-R3 / Prompt 2 MFA mandatory. Email plus password only must open Vauxhall for an active `public.admins` row (owner or operator). Mandatory MFA enroll is bypassed. AAL2 is not required at the Next.js gate or in `is_admin()`.
2. P1-R1 on Home.dc.html only. The public Admin link is restored on the Home footer and mobile menu. It points at `/haus` (Next.js Bond Haus). It does not point at `Admin.dc.html` or `Haus.dc.html`.

## What stays in force

- Admin Design Canvas suite stays cloaked 404 (`Admin.dc.html`, `Vauxhall.dc.html`, `HausAdmin.dc.html`, `Product.dc.html`, `Security.dc.html`, `Social.dc.html`).
- Marketing coexistence stays. `Haus.dc.html` remains the members mock. Bond Haus marketing links stay on that file.
- Non-admin and unauthenticated requests to `/vauxhall` still return cloaked 404. Never 403.
- Admin role is still a server-verified `public.admins` claim. Never a client flag. Never `user_metadata`.
- Audit log stays append-only. Sign-in writes `admin.sign_in` with the waiver id.
- Idle timeout, lockout stub, and no shared accounts stay.
- Zero em dashes and en dashes in this waiver and in the candidate.

## Compensating controls

- Preview and production stay off until Gary go through JB.
- Waiver is time-boxed to Phase 1. MFA returns when Gary lifts this override.
- Home Admin href is `/haus` only. The cloaked HTML suite is not linked.

## Restore MFA

1. Set `PHASE1_MFA_WAIVED` to false.
2. Restore the AAL2 checks in `public.is_admin()` and `public.admin_role()`.
3. Remove or hide the Home Admin link if Prompt 2 zero-trace is back in force.
