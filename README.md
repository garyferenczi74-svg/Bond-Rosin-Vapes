# Bond. Rosin Vapes

Design Canvas marketing pages stay in the repo root. Phase 1 adds a Next.js App Router layer for Bond Haus and Vauxhall beside those pages.

## How static marketing and Next.js coexist

Next.js is the Vercel framework for this repo. Marketing HTML, JS, and `media/` stay where they are. They are not rewritten.

`scripts/link-public.mjs` runs on `predev` and `prebuild`. It symlinks the public marketing files into `public/` so Next can serve the same URLs (`/Home.dc.html`, `/No1.dc.html`, `/FAQ.dc.html`, and the rest).

Next.js owns:

- `/` (redirects to `/Home.dc.html`)
- `/haus` Bond Haus sign-in
- `/vauxhall` and nested wing routes
- Cloaked 404 for unknown routes and for non-admin portal requests

`next.config.ts` keeps extensionless marketing aliases (`/No1` to `/No1.dc.html`, `/Haus` to `/Haus.dc.html`). It does not alias `/haus`. That path is the Next sign-in.

Admin Design Canvas files stay in git (`Admin.dc.html`, `Vauxhall.dc.html`, `HausAdmin.dc.html`, `Product.dc.html`, `Security.dc.html`, `Social.dc.html`). They are not linked from marketing chrome and are not copied into `public/`. Requests to those paths rewrite to the same cloaked 404 as any unknown page. Marketing does not link to Admin.

`robots.txt` and `src/app/robots.ts` do not name Vauxhall or Admin. The sitemap lists marketing pages only.

## Local

```
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm test
npm run lint
npm run dev
```

- http://localhost:3000/haus
- http://localhost:3000/vauxhall (404 unless an AAL2 admin session)
- http://localhost:3000/Home.dc.html

## Env vars

| Name | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | `https://ziruzhhkkndgmdouithb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Legacy anon or publishable key. Browser-safe. |

There is no service role key in this app. There is no MFA bypass, skip, or dev override.

Gary holds production and social publish keys. This repo does not store them. M releases to production only on Gary's go. Carver publishes social only on Gary's go.

## Access model

1. `/haus` is the public sign-in. Visitors see Bond Haus only.
2. Credentials that match an active `admins` row (role `owner` or `operator`) continue to MFA. After AAL2 they land on `/vauxhall`.
3. Non-admin sessions stay on Haus. They never see portal chrome.
4. Unauthenticated or non-admin requests to `/vauxhall` and nested routes return HTTP 404. Never 403.
5. MFA is mandatory. Password alone cannot open Vauxhall. No factor, or AAL1 only, fails closed.
6. Roles are server-verified from `public.admins` plus Supabase Auth AAL2. RLS uses `is_admin()`. Client flags are not a gate.
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

Vercel project `bond-rosin-vapes`. Framework is Next.js (`npm run build`). Set the two `NEXT_PUBLIC_SUPABASE_*` env vars on the project. Keep existing marketing files at the repo root.

No production ship without Vesper PASS, Felix clearance, and Gary go through JB.
