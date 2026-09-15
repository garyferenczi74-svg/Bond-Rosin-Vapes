# Bond. Rosin Vapes

Design Canvas marketing pages stay in the repo root. Phase 1 adds a Next.js App Router layer for Bond Haus and Vauxhall beside those pages.

## Coexistence contract

This is the rule for Vercel. Preview must prove it before anyone promotes production.

| Path | Owner | Expected |
| --- | --- | --- |
| `/` and `/Home.dc.html` | Design Canvas file in `public/` | HTTP 200, homepage |
| `/No1.dc.html`, `/No2.dc.html`, `/No3.dc.html` | Design Canvas | HTTP 200 |
| `/FAQ.dc.html`, `/Terms.dc.html`, `/Privacy.dc.html` | Design Canvas | HTTP 200 |
| `/Haus.dc.html` | Design Canvas members mock | HTTP 200 |
| `/haus` | Next.js Bond Haus sign-in | HTTP 200. Do not rewrite `/Haus` to the mock; Next.js rewrite matching is case-insensitive and would steal this route. |
| `/vauxhall` and nested wing routes | Next.js portal | Cloaked 404 unless an active `public.admins` session (waiver W-2026-09-15-P1-OVERRIDE: password only, MFA not required) |
| `/Admin.dc.html`, `/Vauxhall.dc.html`, other admin HTML | Not copied into `public/` | Cloaked 404 |
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
# set NEXT_PUBLIC_SUPABASE_ANON_KEY
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
curl -sI http://127.0.0.1:3000/bond-brain | head
```

`/` and `/Home.dc.html` must be 200. `/haus` must be 200. `/vauxhall`, `/Admin.dc.html`, and `/bond-brain` must be 404.

## Env vars

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | `https://ziruzhhkkndgmdouithb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Legacy anon or publishable key. Browser-safe. |

There is no service role key in this app. Phase 1 MFA is waived under W-2026-09-15-P1-OVERRIDE (Gary). That is an owner waiver, not a hidden env toggle.

Gary holds production and social publish keys. This repo does not store them. M releases to production only on Gary's go. Carver publishes social only on Gary's go.

## Access model

1. `/haus` is the public sign-in. Visitors see Bond Haus only. Home.dc.html footer and mobile menu expose a public Admin link to `/haus` (not `Admin.dc.html`, not `Haus.dc.html`).
2. Credentials that match an active `admins` row (role `owner` or `operator`) open `/vauxhall` after password auth. MFA enroll is not required under W-2026-09-15-P1-OVERRIDE.
3. Non-admin sessions stay on Haus. They never see portal chrome.
4. Unauthenticated or non-admin requests to `/vauxhall` and nested routes return HTTP 404. Never 403.
5. MFA is waived for Phase 1 by Gary override. Password alone opens Vauxhall for `public.admins`. Restore MFA by setting `PHASE1_MFA_WAIVED` false and putting AAL2 back on `is_admin()`.
6. Roles are server-verified from `public.admins`. RLS uses `is_admin()`. Client flags are not a gate.
7. Sessions idle out at 24 hours (`bond_idle_at` cookie, checked in middleware).
8. Every portal action writes `audit_log`: who, what, before, after, when, from where (ip, user agent, path). The table is append-only.

## Rate limit and lockout stub

`public.record_auth_attempt` hashes the email and records outcomes.

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

Vercel project `bond-rosin-vapes`. `vercel.json` sets framework to Next.js and the build command above. Set the two `NEXT_PUBLIC_SUPABASE_*` env vars on the project. Keep existing marketing files at the repo root.

No production ship without Vesper PASS, Felix clearance, and Gary go through JB.
