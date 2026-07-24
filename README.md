# Bond — Rosin Vapes site

Static site. No build step required.

## Deploy
1. Push this folder's contents to the repo root of
   https://github.com/garyferenczi74-svg/Bond-Rosin-Vapes
   (GitHub web UI: "Add file > Upload files", drag everything in, commit to main).
2. Vercel (bond-rosin-vapes) auto-deploys from main. Framework preset: **Other**, no build command, output directory: root.

## Pages
- index.html -> redirects to Home.dc.html
- Home.dc.html — homepage (age gate, press scrub, selector, Bond Haus)
- No1.dc.html / No2.dc.html / No3.dc.html — SKU pages
- AgeGate.dc.html — shared age gate component
- support.js / image-slot.js — runtime (required)
- .image-slots.state.json — dropped imagery (required)
