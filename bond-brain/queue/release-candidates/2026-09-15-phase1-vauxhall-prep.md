# Phase 1 Vauxhall prep note
Date: 2026-09-15
Author: Q (builder of record)
Status: Repo identified. Coding agent launching on GitHub. Candidate not landed yet.

Repo: https://github.com/garyferenczi74-svg/Bond-Rosin-Vapes
Source: JB via Vercel. Marketing Framer must stay intact. Next.js is the reserved app layer.

Build note: Scope is Prompt 2 Build Order item 1 only. No invented Framer Build Spec. No production ship without Vesper PASS, Felix clearance, and Gary go through JB.

## In scope
- Bond Haus sign-in at /haus
- Admin credentials route session to /vauxhall
- 404 cloaking on admin routes for non-admin (never 403)
- MFA mandatory for every admin account
- Append-only audit log
- Portal frame with four wings stubbed: Vauxhall, Product, Security, Social
- Stack: Next.js App Router + Supabase Auth with RLS
- Admin is a server-verified role claim, never a client flag
- Design language from Prompt 2 / brand-tokens.md (admin section)

## Design tokens (admin)
- Surfaces: Matte Black (token)
- Cards: Deep Charcoal (token)
- Type: Bone (token)
- Aptos for all UI
- GFS Didot for wing titles only
- Wing hairlines: Vauxhall bone, ERP No. 1 green ink, Security No. 3 oxide ink, Social No. 2 blue ink
- Dense control room. Never cluttered.
- Standing bans: no exclamation points, no em-dashes, no en-dashes anywhere

## Out of scope this phase
- Changing Framer marketing pages (keep intact)
- Wings beyond stubs
- Production release
- Invented M1 to M6

## Marketing ADMIN nav (IN THIS REPO)
Confirmed in public tree:
- Home.dc.html footer includes a public Admin link
- Admin.dc.html, Haus.dc.html, HausAdmin.dc.html, Vauxhall.dc.html, Product.dc.html, Security.dc.html, Social.dc.html exist as static pages
Phase 1 must neutralize public Admin link(s) and cloaking without rewriting marketing pages.
Repo today is static Design Canvas (no Next.js yet). Reserved Next layer is additive.
Live marketing reference: https://bond-rosin-vapes.vercel.app/ (do not reverse-spec mockups).

## Canon sources
- /workspace/bond-brain/canon/specs/prompt-2-vauxhall.md
- /workspace/bond-brain/canon/brand-tokens.md (Version 2026-09-15)
- /workspace/bond-brain/canon/copy-bank.md

## Blockers reported to JB
- Cursor GitHub access card with Gary; Phase 1 relaunches when repo is visible
- Repo is static marketing HTML today; Next.js Phase 1 must be additive
- Public Admin footer link and admin HTML pages live in-repo (not Framer-only)
- Box gh CLI not authenticated (narrow lookups via public API for now)
