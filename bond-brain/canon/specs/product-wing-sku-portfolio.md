# Product wing: SKU Portfolio build
Version: 2026-09-15
Status: ACTIVE brief for Next /vauxhall Product wing
Gary directive: build out Products with our 3 SKUs
Depends on: /canon/specs/sku-portfolio.md, brand-tokens.md, copy-bank.md, prompt-2-vauxhall.md Wing 2

## Scope (this pass)
Replace the Product wing placeholder with a real SKU Portfolio for the three standing numbers.
Out of scope for this pass unless JB expands: full Inventory, Orders, Accounts, Board Metrics, Unit Economics (Prompt 2 Phase 3 remainder).

## Routes
Target under live Next /vauxhall Product wing (path routing as currently shipped):
- Product / SKU Portfolio as default Product landing
- Optional detail route per SKU (No. 1 / No. 2 / No. 3) if needed for density

## Layout (ViaConnect reference patterns, Bond-skinned)
- Left sidebar Product wing active
- Dense card grid: one card per SKU
- Metric row optional (three counts: active SKUs, formats, lifecycle)
- No ViaConnect orange. Radius 0 to 4 px.
- Surfaces Matte Black #1B1D1C, cards Deep Charcoal #2A2A2A, type Bone #E1DAD0
- Aptos UI. GFS Didot for wing title Product (or SKU Portfolio) only
- Each card uses that SKU accent as hairline only (No. 1 #79C84A, No. 2 #86ACE3, No. 3 #A53A28). One accent per card.

## Card contents (per SKU)
Number, edition name, moment, triad, bond line, accent swatch as hairline, formats (0.5g / 1g), lifecycle state.
No potency-as-personality copy. No health claims.

## Behavior
- Seed from sku-portfolio.md through VauxhallStore (or Product store seam). UI does not hardcode hex.
- Adding a fourth SKU later must be data-driven.
- Social and other wings unchanged. Vauxhall.dc.html stays cloaked.
- Copy bans: no exclamation points, no em-dashes, no en-dashes.

## Acceptance
1. Product wing shows exactly three SKUs: Dialed, Unwind, Peak with Prompt 1 triads and hexes above.
2. One accent hairline per card. Zero orange fills. Radius at or under 4 px.
3. Didot only on wing titles. Aptos elsewhere.
4. Grep of new UI strings for em/en dashes returns zero.
5. No invented inventory, COA, or economics claims beyond labeled mock seed.
