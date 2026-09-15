# Bond — Rosin Vapes site

Static site. No build step required.

## Deploy
1. Push this folder's contents to the repo root of
   https://github.com/garyferenczi74-svg/Bond-Rosin-Vapes
   (GitHub web UI: "Add file > Upload files", drag everything in, commit to main).
2. Vercel (bond-rosin-vapes) auto-deploys from main. Framework preset: **Other**, no build command, output directory: root.

## Pages
- index.html and `/` rewrite to Home.dc.html
- Home.dc.html: homepage (age gate, press scrub, selector, Bond Haus)
- No1.dc.html / No2.dc.html / No3.dc.html: SKU pages
- AgeGate.dc.html: shared age gate component
- support.js / image-slot.js: runtime (required)
- .image-slots.state.json: dropped imagery (required)
- Existing `*.dc.html` links stay valid. Extensionless marketing paths (`/No1`, `/FAQ`, `/Haus`, and lowercase peers) rewrite to the matching file. Admin paths are not rewritten.

## Public chrome
- Marketing footers do not link to Admin.
- Admin HTML files stay in git. They are not linked from public marketing chrome.
- `robots.txt` disallows `/Admin*` and `/bond-brain/`.
- `vercel.json` returns 404 for `/bond-brain/**` and keeps the vault in the repo.

## Supabase (Gary)
- Not applied by this static deploy. SQL only.
- Run `supabase/migrations/20260915183000_revoke_definer_execute_and_document_rls.sql` in the Bond-Rosin-Vapes SQL editor. See `supabase/README.md`.
