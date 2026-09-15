# Deployment
Version: 2026-09-15

## Public marketing site
- URL: https://bond-rosin-vapes.vercel.app/
- Host: Vercel (ViaConnect team)
- Project: bond-rosin-vapes (`prj_t57zdACUUpzxtYcfZdAlrTTySxyH`)
- GitHub: garyferenczi74-svg/Bond-Rosin-Vapes
- Latest production: `dpl_2b3CbZzqkPAcKxUdWSYBfpfk9ZVP` READY (2026-08-21)
- Role: public Bond surface (static Design Canvas site: Home.dc.html and related; not Framer-only)
- Public Admin trace: Admin link in Home.dc.html (nav/footer). Admin, Haus, and Vauxhall HTML stubs already exist in repo.
- Phase 1 constraint (Q via JB): add Next.js Access shell without rewriting marketing pages; neutralize public Admin traces. No ship until Gary go.
- Note: project API flag live=false; production deployment still READY. SSO protection on all_except_custom_domains.

## Admin portal (Vauxhall)
- Spec: Prompt 2 (canon/specs/prompt-2-vauxhall.md)
- Path model: invisible until admin auth; Bond Haus at /haus; admin routes at /vauxhall
- Stack target: Next.js App Router + Supabase Auth (RLS), same domain subpath or haus subdomain
- Status: design canon only until Gary greenlights Phase 1 build

## Notes
- Prompt 2 Drive link is the same FarmCeutica folder previously flagged. Do not treat it as Bond asset source.
- 2026-09-15 repo shape (Q via JB): Design Canvas static marketing; Phase 1 Next.js beside it, not a marketing rewrite.
