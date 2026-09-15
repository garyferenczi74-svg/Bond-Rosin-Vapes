# QC checklist: Phase 1 Next.js access shell

Owner: Vesper
Status: standing for Phase 1 only
Filed: 2026-09-15
Routed by: JB (Phase 1 greenlit)
Source: Prompt 2 Vauxhall (/canon/specs/prompt-2-vauxhall.md) Phase 1 build order + acceptance items 1, 2, 8; JB Phase 1 scope note

Scope: Bond Haus sign-in, admin trigger to /vauxhall, 404 cloaking, MFA, audit log, portal frame with four wings stubbed. Next.js App Router layer. Not the Framer marketing site.

Out of scope for this Phase 1 portal QC:
- Age gate (JB: not in Phase 1 scope for portal)
- Framer marketing acceptance (still blocked elsewhere)
- Wings beyond stubs (Command, Product, Security, Social full features)
- Prompt 2 acceptance items 3 to 7 (later phases)

Verdict rule: binary only. PASS with evidence, or FAIL with exact element, exact criterion, and screenshot or measurement. No soft passes.

File every verdict to JB and M at the same time. FAIL returns to Q with the receipt.

Await candidate in /queue/release-candidates before inspecting.

---

## A. 404 cloaking

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Non-admin on portal routes | Non-admin session receives HTTP 404 on every portal route, including direct deep links to /vauxhall and wing paths | Any portal route returns 403, 401 body that admits a portal, redirect to login that reveals admin surface, or 200 with portal chrome |
| Never 403 | Portal answers 404, never 403, for unauthorized access | Any 403 on a portal route |
| Public traces | Zero portal traces in public source, sitemap, and robots for the candidate surface | Admin link, /vauxhall, or portal route names in nav, footer, sitemap, robots, or public page source |
| Bond Haus only | Unauthenticated visitors at /haus see only Haus sign-in; no admin CTA | Visible admin entry on Haus or marketing adjacency in this candidate |

## B. MFA path

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| MFA mandatory | Admin sign-in without MFA is impossible | Admin session can complete without MFA challenge |
| MFA on every admin | Every admin account requires MFA | Any admin path or role skips MFA |
| Evidence | Attach path proof: challenge screen, enforcement config or test log showing blocked without MFA | Claim without measurement or screenshot |

## C. Audit log presence

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Append-only log exists | Audit log surface or store is present and append-only for admin actions | No audit log, or mutable/editable history without insert-only constraint |
| Action capture | Every admin action writes who, what, before, after, when, from where | Missing fields on a sampled action; actions that leave no row |
| Phase 1 sample | At least one Phase 1 admin action (sign-in success, MFA enroll or verify, or stub wing navigation if logged) produces a verifiable audit row | No row after a required action |

## D. Admin UI tokens

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Surfaces | Matte Black #1B1D1C for surfaces | Off-token surface color on admin chrome |
| Cards | Deep Charcoal #2A2A2A for cards | Off-token card color |
| Type color | Bone #E1DAD0 for type on dark admin surfaces | Off-token type color for primary UI text |
| UI font | Aptos for all UI | Body or controls in Didot or an unapproved face |
| Didot use | GFS Didot Regular 400 for wing titles only; never bolded | Didot on non-title UI, or bolded Didot |
| Wing accents | Accent hairlines only for wing identity (per Prompt 2 ink mapping); not fills | Accent used as fill, or multiple competing fills |
| Viewports | Visual token pass at 1440 and 390 on Haus and Vauxhall shell | Token break at either viewport |

## E. Zero dashes

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Em dash / en dash | Zero U+2014 and U+2013 anywhere in the candidate: UI strings, seeds, code comments, logs, layer names, embeds | Any em dash or en dash found |

## F. Phase 1 shell completeness (stub only)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Haus | /haus sign-in present | Missing Haus sign-in |
| Admin trigger | Matching admin credentials route session to /vauxhall from the same sign-in | Separate public admin URL required, or admin cannot reach /vauxhall |
| Portal frame | Four wings stubbed inside the portal frame | Missing wing stubs or full wing builds claimed as Phase 1 without JB scope change |

---

## Receipt template (Phase 1)

### PASS
- Candidate:
- Date:
- Checks: A to F
- Evidence: (404 traces, MFA proof, audit row sample, token screenshots at 1440 and 390, dash scan)
- Filed to: JB, M

### FAIL
- Candidate:
- Date:
- Element:
- Criterion: (exact row above)
- Receipt: (screenshot path or measurement)
- Returned to: Q
- Filed to: JB, M
