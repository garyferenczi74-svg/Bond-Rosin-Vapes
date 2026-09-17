# Copy bank
Version: 2026-09-16 (Prompt 6b residual Haus door membership word; Prompt 4 Torrie locks stand)

## Hero
BOND WITH YOUR HIGHEST SELF.

## Triads
- Focus. Clarity. Momentum.
- Release. Stillness. Restoration.
- Edge. Elevation. Expansion.

## Bond lines
- your potential
- the moment
- your edge

## Editions
- No. 1 Dialed (daytime)
- No. 2 Unwind (nighttime)
- No. 3 Peak (reserve)
See /canon/specs/sku-portfolio.md for full SKU fields.

## Voice
Short declaratives. Sensory precision. No slang. Confidence through economy.

## Forbidden vocabulary
dank, loud, gas, stoned, hits, rips, medicated, cure, heal, treat

## Standing bans
- Exclamation points
- Em-dashes
- En-dashes

## Conflict notes
- Bond Master Brand Guide listed No. 2 as Stillness Rest Ease and No. 3 as Euphoria Bliss Indulgence. Prompt 1 wins: triads stay Focus. Clarity. Momentum. / Release. Stillness. Restoration. / Edge. Elevation. Expansion. (Gary 2026-09-15).
- Edition names Dialed / Unwind / Peak from the Guide are allowed as product names. They do not replace bond lines.

## Prompt 4 locked strings (JB 2026-09-15)
Standing brief: /canon/specs/prompt-4-site-copy-torrie.md
Surface: static Home / No1 / No2 / No3 `.dc.html` only. Haus and Vauxhall OUT.
Dash rule: zero em/en dashes. Torrie dash rhythm not restored.

### Global find/replace
| Id | Find | Replace |
| --- | --- | --- |
| C1 | Three Numbers | The Numbered Collection |
| C2 | Choose your moment / CHOOSE YOUR MOMENT | From Plant to Bond (Finder target URL unchanged) |
| C3 | Not sure what number is yours | Find your no. (lowercase `no.` exact) |

### C4 tinted brand line (SKU pages only)
When the product is pure, the experience is real. Bond.
Final `Bond.` uses page accent span (period inside tint): No. 1 `#79C84A`, No. 2 `#86ACE3`, No. 3 `#A53A28`. Non-SKU pages: omit or full body colour.

### Gold / design (C5)
OUT this pass (Gary 2026-09-15): COPY ONLY. Gold and design untouched. Do not remove gold or retokenize UI under Prompt 4. Photography and Peak foil stay. C4 tinted `Bond.` accent span is copy treatment only (existing page accent token, no new palette).

### From Plant to Bond block (Felix-approved body; no fresh-frozen phrasing)
Headline: FROM PLANT TO BOND
Body: We start with exceptional cannabis, then use heat, pressure, and time to preserve what is real. The result is 100% solventless live rosin, nothing added, nothing removed.
Do not publish "and fresh frozen plants" in this block. SKU Source strip "Fresh frozen" is a separate Product truth pass, not this journey body.

### No. 1 Dialed (5.1)
Moment eyebrow: THE MOMENT
Moment headline: FOR THE MOMENT YOU NEED TO SHOW UP FULLY.
Moment body: Dialed is for forward motion, the moments that demand your full presence. Formulated for focus, clarity, and momentum. 100% solventless live rosin, the plant extracted without compromise, so you get everything it has to offer. Every terpene. Every cannabinoid. The full experience, nothing removed.
SKU strip title: No. 1 DIALED (DIALED in `#79C84A`)
SKU strip line: A focused expression from Bond's solventless live rosin collection.
SKU strip tagline: Clarity. Momentum. (in `#79C84A`)
Edit eyebrow: THE DIALED EDIT
Edit statement: Curated for clarity. Designed for forward motion.
Edit bond line: Bond with your potential. (`Bond` in `#79C84A`)
Hero state line: OMIT (locked).

### No. 2 Unwind (5.2 as filed)
Hero: No. 2 / UNWIND
Bond line: Bond with the moment.
State line: Rest & Reflection.
Button: Find No. 2
Moment eyebrow: THE MOMENT
Moment headline: FOR THE MOMENT THE PACE SOFTENS.
Moment body: Unwind is for the moment you give yourself permission to stop.
SKU strip title: No. 2 | UNWIND (UNWIND in `#86ACE3`)
SKU strip line: A cooler, quieter number in Bond's 100% solventless live rosin collection.
Edit section: OMIT (clean omission).

### No. 3 Peak (5.3)
Hero: No. 3 / PEAK (in `#A53A28`) / THE RESERVE EDITION
Bond line: Bond with your edge.
State line: The Alpine State.
Button: Find No. 3
Moment eyebrow: THE MOMENT
Moment headline: FOR THE MOMENT THAT CALLS FOR MORE.
Moment body: Peak is the reserve expression of Bond's 100% solventless live rosin collection. Richer, deeper, and made for a more deliberate kind of arrival.
SKU strip title: No. 3 | PEAK (PEAK in `#A53A28`)
SKU strip line: A reserve expression from Bond's solventless live rosin collection.
SKU strip tagline: Higher presence. Deepest expression.

### Preserved (untouched)
Nav set (No. 1 Dialed, No. 2 Unwind, No. 3 Peak, From Plant to Bond, Find Your Bond, Bond Circle). Hero "Bond with your highest self". Five-zeros purity strip. Footer 21+ line.

## Prompt 6b residual (Haus door membership word)
Standing brief: /canon/specs/prompt-6b-residual-haus-only-membership.md
Surface: Next `/haus` door plus No1 / No2 / No3 footer Bond Haus href. Home waitlist already Haus-named.
This does not claim Prompt 6 / 6a / 6e / 6g / 6h DONE.

| Slot | Locked string |
| --- | --- |
| Invitation caption | Membership is by invitation from the Haus. |
| Reciprocal | Not yet a member? Join the Bond Haus for first access. |
| Reciprocal href | `/#haus` |
| Didot (unchanged) | The Haus is for members. |
| Fail line (unchanged) | That did not open the door. |

Haus is the only membership word on `/haus`. Circle is not user-visible on that door.
`id=circle` and `bond_circle` stay as documented aliases. They are not membership words.

## Dispensary Login / Header Place Order (2026-09-17)

Standing brief: `/canon/specs/dispensary-login-header-place-order.md`

| Slot | Locked string |
| --- | --- |
| Header tab | Place Order |
| Header href | `/order` |
| Hero membership CTA | ENTER THE BOND HAUS |
| Hero href | `/haus` |
| Logged-out title | Dispensary Login |
| Logged-out tabs | Sign up / Sign in |
| Sign up fields | Dispensary name, Address, Contact name, Phone number, OCM number, Email, Create password, Confirm password, 21+ |
| Sign in fields | Email, Password |
| Pending wait | This account is pending. Bond operations must elevate it before reservation access opens. |
| Logged-in title | Order reservation |
| Age gate | For adults 21 and over. |
