# Prompt 6 dual Home hero controller unify
Date: 2026-09-16
Author: Q RC; JB lock; Moneypenny ingest
Source: Gary resume via JB. Gap report P1 dual controllers. Site-audit 2026-09-15.
Status: ACTIVE for this unify only. Full Prompt 6-series stays PARTIAL. Do not claim Prompt 6 / 6a / 6e / 6g / 6h DONE.

## Product lock
One owner for Home `#hero-video` attach, playback, and endplate. Prefer `video-policy.js`. Keep tip visual behavior.

## JB locks closed
1. `video-policy.js` is the sole owner of attach, playback, IO, reduced-motion, Save-Data, and endplate `fillPlate` / `showPlate`.
2. Home IIFE must not call `BondVideo.attach` / `BondVideo.release` and must not write endplate opacity or srcset.
3. Case A `--hero-copy-top` plus flow fallback stays a thin Home layout helper. No attach. No endplate ownership.
4. Home may listen to `bond-entered` for layout only. Never re-attach.
5. Tip visual parity: one-shot play into endplate; copy clearance; CTAs; reduced-motion plate path via policy.
6. SKU pages unchanged.
7. PR delivery note must include the before/after ownership map and name these closed locks.

## Before (tip PR23)
| Concern | `video-policy.js` | Home IIFE |
| --- | --- | --- |
| Cold attach | `boot()` attaches all `[data-bond-video]` | Also `BondVideo.release()` plus `BondVideo.attach(v)` after `bond-entered` / start |
| Playback / IO / reduced-motion / Save-Data | Owns | Does not own |
| Endplate fill / show | `fillPlate` / `showPlate` | Competing `syncEndplate` geometry plus reduced-motion JPG plate path |
| Copy lockup (`--hero-copy-top`, `hero-copy-flow`) | Does not own | Owns Case A plus flow fallback |
| SKU pages | Sole owner | N/A |

## After
| Concern | Owner | Notes |
| --- | --- | --- |
| Cold attach | `video-policy.js` only | Exactly one attach path on cold start |
| Playback / IO / reduced-motion / Save-Data / endplate fill-show | `video-policy.js` only | Home has no `.hero-endplate-on` writers |
| Case A copy lockup plus flow fallback | Thin Home layout helper | Layout may listen to `bond-entered`. Never attaches. Never owns endplate opacity |
| SKU pages | Unchanged (`video-policy.js` only) | Loop. No endplate |

## Out of this unify
- Claiming Prompt 6 / 6a / 6e / 6g / 6h DONE
- Missing docs 6c / 6d / 6f
- Full Vesper laptop/tablet matrices
- Gold / design / typography / copy churn
- MFA / Social / Metrc / 2E enablement
- Hero encode ladder / 720p wiring

Tip stays `dpl_DiDEToLo7DGUgB3HbGgikK4vd2uM` until READY after this ship. PR workflow. No direct-to-main.

Flags: /canon/specs/prompt-6-dual-hero-controller-unify-flags.md
