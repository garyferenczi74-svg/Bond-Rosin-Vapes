# Standing QC checklist

Owner: Vesper
Status: standing (partial)
Filed: 2026-09-15
Source directive: /inbox/05-vesper-qc-checklist.md

Sources used for this version:
- agents/vesper.md (charter standing lints)
- canon/brand-tokens.md
- canon/copy-bank.md
- agents/felix.md (age gate surface only, as QC verifies the gate behavior)

Blocked:
- Framer Build Spec v1.0 acceptance list is not in the vault. Spec library still awaiting Drive documents. When it lands, append a dated "Active spec acceptance" section and bump the version line. Do not invent Framer criteria.

Verdict rule: binary only. PASS with evidence, or FAIL with exact element, exact criterion, and screenshot or measurement. No "mostly fine."

Viewports for every visual pass: 1440 and 390.

File every verdict to JB and M at the same time. FAIL returns to Q with the receipt.

---

## 1. Typography

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Header font | GFS Didot Regular 400 only | Any other face, weight, or synthetic bold on headers |
| Didot weight | Never bolded (no fake bold) | Bold, semibold, or browser-synthesized bold on Didot |
| Body font | Aptos for supporting text | Body set in Didot or an unapproved face |
| Wordmark tracking | 0.35em minimum | Tracking under 0.35em |

## 2. Color and surfaces

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Tokens only | Surfaces use Bone #E1DAD0, Matte Black #1B1D1C, Deep Charcoal #2A2A2A, No. 1 #79C84A, No. 2 #86ACE3, No. 3 #A53A28 (or named tokens equivalent) | Raw off-system hex in the candidate |
| Accent count | One SKU accent per surface | Two or more SKU accents on one surface |
| Accent treatment | Accents as hairlines, never fills | Accent used as a fill |
| Ink on light | Accent text at or under 18 px on light surfaces uses ink variants | Bright accent hex on small text on Bone or other light field |
| Radius | 0 to 4 px | Radius above 4 px |

## 3. Motion

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Loud gestures | Only Arrival, Press, Three Worlds are Signature Moments | Any other motion uses Signature Moment intensity |
| Default motion | Opacity plus 12 px rise, 400 to 600 ms, cubic-bezier(0.22, 1, 0.36, 1) | Default motion outside that contract |
| Reduced motion | Prefers-reduced-motion collapses to opacity only | Translate, scale, or other motion still runs under reduced motion |

## 4. Copy and bans (visible strings, layer names, embeds, alt, meta)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Em dash / en dash | Zero em dashes and en dashes anywhere, including layer names and embeds | Any U+2014 or U+2013 character in the candidate surface or source layers inspected |
| Exclamation points | None in house copy | Any exclamation point in brand copy |
| Forbidden vocabulary | None of: dank, loud, gas, stoned, hits, rips, medicated, cure, heal, treat | Any forbidden term in visible or embedded copy |
| Hero | "BOND WITH YOUR HIGHEST SELF." when the hero is present | Altered hero line |
| Triads | Period-separated forms only when used | Comma or dash joined triads |

## 5. Age gate and deep links

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Gate on routes | 21+ age gate on every route inspected | Any route loads content past the gate without confirmation |
| Deep links | Deep links are blocked by the age gate | A deep link bypasses the gate into gated content |

## 6. Video

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Loop | Videos loop | Video stops at end without loop |
| Poster | Each video has a poster | Missing poster |
| Homepage weight | Homepage video under 15 MB | Homepage video 15 MB or larger |

## 7. Performance

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| LCP | LCP under 2.5 s on the inspected candidate URL (measure and attach) | LCP 2.5 s or above, or no measurement attached |

## 8. Mockup parity

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| 1440 | Candidate matches approved mockup at 1440 (layout, type, accent placement) | Material delta from approved mockup at 1440 |
| 390 | Candidate matches approved mockup at 390 | Material delta from approved mockup at 390 |

Note: mockup archive is empty as of filing (awaiting Drive assets). Until approved mockups exist, section 8 is BLOCKED and any candidate that requires mockup parity cannot receive PASS.

## 9. Active spec acceptance (Framer Build Spec v1.0)

Status: BLOCKED. Source document not in /canon/specs/.

When Framer Build Spec v1.0 is filed, extract its acceptance list here as dated checklist rows. Until then, do not invent rows.

---

## 10. Phase 1 Next.js access shell

Active Phase 1 QC lives in /canon/specs/qc-phase1-access-shell.md (JB greenlit 2026-09-15).
Age gate is out of scope for that portal Phase 1 pass. Framer sections above remain unchanged.

---

## Receipt template

### PASS
- Candidate:
- Date:
- Viewports checked: 1440, 390
- Evidence: (paths to screenshots, LCP measurement, file size)
- Standing lints: all pass
- Spec acceptance: (n/a until section 9 filled, or list rows checked)
- Filed to: JB, M

### FAIL
- Candidate:
- Date:
- Element:
- Criterion: (exact row from this checklist)
- Receipt: (screenshot path or measurement)
- Returned to: Q
- Filed to: JB, M
