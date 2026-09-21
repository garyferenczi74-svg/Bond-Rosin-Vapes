# Bond. Rosin Vapes

Design Canvas marketing pages stay in the repo root. Phase 1 adds a Next.js App Router layer for Bond Haus and Vauxhall beside those pages.

## Coexistence contract

This is the rule for Vercel. Preview must prove it before anyone promotes production.

| Path | Owner | Expected |
| --- | --- | --- |
| `/` and `/Home.dc.html` | Design Canvas file in `public/` | HTTP 200, homepage |
| `/No1.dc.html`, `/No2.dc.html`, `/No3.dc.html` | Design Canvas | HTTP 200 |
| `/FAQ.dc.html`, `/Terms.dc.html`, `/Privacy.dc.html` | Design Canvas | HTTP 200 |
| `/haus` | Next.js Bond Haus sign-in | HTTP 200. Do not rewrite `/Haus` to the mock; Next.js rewrite matching is case-insensitive and would steal this route. |
| `/order` | Next.js Dispensary Login and order reservation | HTTP 200. Logged-out Sign up / Sign in door. Pending wait or elevated reservation. noindex. Header Place Order is the public CTA. |
| `/vauxhall` and nested wing routes | Next.js portal | Cloaked 404 unless an active `public.admins` session (waiver W-2026-09-15-P1-OVERRIDE: password only, MFA not required) |
| `/Admin.dc.html`, `/Haus.dc.html`, `/Vauxhall.dc.html`, other admin HTML | Not copied into `public/` | Cloaked 404 |
| `/bond-brain` | Blocked | Cloaked 404 |

Marketing HTML is never rewritten. `scripts/sync-public.mjs` **copies** allowlisted root files into `public/` as real files (not symlinks) before `next build`. It also writes `public/index.html` from `Home.dc.html` so `/` has a static file if the dashboard still treats the project as Other. Admin HTML is not in that list. The script fails the build if a copy stays a symlink or if admin HTML appears under `public/`.

`vercel.json` pins `framework` to `nextjs` and sets `buildCommand` to `node scripts/sync-public.mjs && next build`. It also lists the marketing rewrites, including `/` to `/Home.dc.html`. It does not rewrite `/haus` or `/vauxhall`.

`next.config.ts` repeats those marketing rewrites under `beforeFiles` so `next dev` and `next start` match Vercel.

Do not set a Vercel Output Directory. Next.js owns the output. A leftover `public` output on a static/Other project will serve an empty folder and 404 the whole alias. The dashboard `framework` field is still `null`. The repo pin is what makes this deploy a Next.js app.

## Why PR #3 404'd the alias

1. Marketing files live at the repo root. Next.js only publishes files that exist as real files under `public/` at build time.
2. PR #3 gitignored `public/**` and created **symlinks** via `prebuild`. Vercel ran `next build`. The output kept those symlinks. The CDN/static file map did not contain `Home.dc.html` or the SKU pages.
3. `/` was a Next.js redirect to `/Home.dc.html`, so the homepage alias also failed.
4. The Vercel project `framework` field is still `null` (legacy Other/static). An empty `public/` is the classic static output folder. That combination is unsafe if Next.js is not pinned.

This branch copies real files (including `index.html`), pins Next.js, and adds explicit marketing rewrites.

## Local

```
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_ANON_KEY and server-only SUPABASE_SERVICE_ROLE_KEY
npm install
npm test
npm run lint
npm run build
npm run start
```

Verify:

```
curl -sI http://127.0.0.1:3000/ | head
curl -sI http://127.0.0.1:3000/Home.dc.html | head
curl -sI http://127.0.0.1:3000/haus | head
curl -sI http://127.0.0.1:3000/vauxhall | head
curl -sI http://127.0.0.1:3000/Admin.dc.html | head
curl -sI http://127.0.0.1:3000/Haus.dc.html | head
curl -sI http://127.0.0.1:3000/bond-brain | head
```

`/` and `/Home.dc.html` must be 200. `/haus` must be 200. `/vauxhall`, `/Admin.dc.html`, `/Haus.dc.html`, and `/bond-brain` must be 404.

## Env vars

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | `https://ziruzhhkkndgmdouithb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Legacy anon or publishable key. Browser-safe. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` server-only | Lockout writes to `record_auth_attempt`. Never `NEXT_PUBLIC_`. Never log. Required in the same window as M apply of `2026-09-21-supabase-harden-rls-rpc-migration.sql`. |
| `METRC_ADAPTER` | Vercel Preview only | Empty or `mock` keeps MetrcMockAdapter. `connect` selects MetrcConnectAdapter. Production Vercel, `METRC_ENV=production`, and `METRC_LIVE=on` stay on mock. |
| `METRC_SANDBOX_INTEGRATOR_VENDOR_KEY` | Vercel Preview secret store | Integrator vendor key. Server-only. Never `NEXT_PUBLIC_`. Rotate on personnel change. |
| `METRC_SANDBOX_LICENSEE_USER_KEY` | Vercel Preview secret store | Licensee user API key. Server-only. Rotate on personnel change. |
| `METRC_SANDBOX_FACILITY_LICENSE` | Vercel Preview secret store | Facility license scope for sandbox pulls. |
| `METRC_SANDBOX_BASE_URL` | Vercel Preview | Optional. Defaults to `https://sandbox-api-ny.metrc.com`. Production Metrc hosts are blocked. |

Lockout writes use `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never expose it to the browser. Production Metrc keys are not read in Phase B1. Do not set `METRC_LIVE=on`. Phase 1 MFA is waived under W-2026-09-15-P1-OVERRIDE (Gary). That is an owner waiver, not a hidden env toggle.

Gary holds production and social publish keys. This repo does not store them. M releases to production only on Gary's go. Carver publishes social only on Gary's go.

## Access model

1. `/haus` is the public sign-in. Visitors see Bond Haus only. Home.dc.html footer and mobile menu expose a public Admin link to `/haus` (not `Admin.dc.html`, not `Haus.dc.html`). Home hero, Haus waitlist (hash alias `id=circle` for `/#circle`), signup success, and footer Bond Haus also enter at `/haus`. SKU footer Bond Haus on No1 / No2 / No3 also enters at `/haus`. Home header Place Order enters at `/order`. Hero ENTER THE BOND HAUS stays on `/haus`.
2. Credentials that match an active `admins` row (role `admin`, `owner`, or `operator`) open `/vauxhall` after password auth. MFA enroll is not required under W-2026-09-15-P1-OVERRIDE.
3. Demo member `member@bond.test` (any password) is mock member auth. It never opens `/vauxhall`. First visit shows the welcome interstitial and a 21+ affirm, then `/haus/salon` (frame and Sign Out only). The shelf seeds empty.
4. Unknown email, wrong password, or a signed-in user who is not an admin and not the demo member receives the generic door line. Non-admin sessions never see portal chrome.
5. Unauthenticated member room deep links return to the `/haus` door. Unauthenticated or non-admin requests to `/vauxhall` and nested routes return HTTP 404. Never 403. `/Haus.dc.html` stays cloaked 404. There is no `/haus/admin`.
6. MFA is waived for Phase 1 by Gary override. Password alone opens Vauxhall for `public.admins`. Restore MFA by setting `PHASE1_MFA_WAIVED` false and putting AAL2 back on `is_admin()`.
7. Admin roles are server-verified from `public.admins`. RLS uses `is_admin()`. Member role for Phase A is the demo mock cookie. Client flags are not a gate.
8. Sessions idle out at 24 hours (`bond_idle_at` cookie, checked in middleware). Member mock session uses the same day window.
9. Every portal action writes `audit_log`: who, what, before, after, when, from where (ip, user agent, path). The table is append-only.
10. `/order` logged-out is Dispensary Login with Sign up and Sign in tabs. Sign up collects dispensary name, address, contact name, phone, OCM license number, email, create password plus confirm, and 21+. Register creates a pending partner credential only. Sign in is email plus password. Pending sessions see a wait message and no reservation. Ops must elevate before reservation access opens. Invite codes are retired. Passwords are hashed, never logged in plaintext, and never sent to Metrc. Elevated `/order` is the order reservation surface only. No unauthenticated order create. No Metrc write. No Metrc-verified claim. B4 HOLD. Haus stays out of commerce.

## Rate limit and lockout stub

`public.record_auth_attempt` hashes the email and records outcomes. The `/haus` door calls it through a server-only service_role client (`src/lib/supabase/service.ts`). After M applies `2026-09-21-supabase-harden-rls-rpc-migration.sql`, EXECUTE is postgres + service_role only. `is_admin`, `admin_role`, and `mark_admin_mfa_enrolled` stay on the authenticated user session path.

- 5 failures in 15 minutes issue a `lockout` row
- Lockout holds 30 minutes
- Sign-in copy stays generic. The door does not confirm a lockout.

Phase 1 alerting is a stub: lockout rows are queryable. Wire Felix Security watch and paging in a later phase. Production should also add Vercel WAF or an edge limiter in front of `/haus`. This in-database stub is not a substitute for that.

No shared admin accounts. One human per `admins` row.

## Supabase

Project: Bond-Rosin-Vapes (`ziruzhhkkndgmdouithb`).

Phase 1 SQL is in `supabase/migrations/`. It was applied to that project. It does not delete marketing data (`dispensaries`, `ny_cities`, reserve tables stay).

If a fresh environment needs the same schema, run the files in order in the SQL editor. See `supabase/README.md`.

Anon `EXECUTE` on `is_admin()` and `rls_auto_enable()` is revoked. `is_admin()` is granted to `authenticated` so RLS policies can evaluate it.

## Deploy

Vercel project `bond-rosin-vapes`. `vercel.json` sets framework to Next.js and the build command above. Set the two `NEXT_PUBLIC_SUPABASE_*` env vars and the server-only `SUPABASE_SERVICE_ROLE_KEY` on the project. Keep existing marketing files at the repo root.

No production ship without Vesper PASS, Felix clearance, and Gary go through JB.
