# Phase 1 Pre-Check and Rules

Owner: Felix
Status: standing (Phase 1 Access shell)
Filed: 2026-09-15
Source: Prompt 2 Access Model and Acceptance; JB Phase 1 route 2026-09-15
Applies to: Bond Haus sign-in, admin trigger, 404 cloaking, MFA, audit log, portal frame (four wings stubbed)

Verdict rule: binary only. PASS with evidence, or FAIL with exact surface, exact criterion, and receipt. No soft passes.

Felix clearance for a Phase 1 candidate is current only when every check below is PASS on that candidate. Appeals go to Gary through JB only.

When Q lands a candidate in /queue/release-candidates/, Felix runs this Pre-Check and files the verdict to JB and M. FAIL returns to Q with the receipt. Do not contact Gary from this gate.

---

## Rules (enforced)

These are Rules data for the Security wing. Citations point at Prompt 2. Enforcement runs at Pre-Check (this doc) and at runtime once Scanner Bridge exists.

| Rule id | Rule | Citation | Severity if broken |
| --- | --- | --- | --- |
| P1-R1 | Zero public admin traces | Prompt 2 Access Model: no admin link in navigation, sitemap, robots, or page source | P0 |
| P1-R2 | Non-admin portal requests return cloaked 404, never 403 | Prompt 2 Access Model and Acceptance 1 | P0 |
| P1-R3 | MFA mandatory for every admin account; admin sign-in without MFA is impossible | Prompt 2 Access Model hard requirements; Acceptance 2 | P0 |
| P1-R4 | Audit log is append-only and immutable (insert-only at database level); every admin action writes who, what, before, after, when, from where | Prompt 2 Access Model; Data Model audit_log; Acceptance 2 | P0 |
| P1-R5 | Admin role is a server-verified claim, never a client flag | Prompt 2 Access Model stack | P0 |
| P1-R6 | No shared admin accounts | Prompt 2 Access Model hard requirements | P1 |
| P1-R7 | Admin sessions expire at 24 hours idle | Prompt 2 Access Model hard requirements | P1 |
| P1-R8 | Sign-in is rate limited with lockout and alerting | Prompt 2 Access Model hard requirements | P1 |

Waivers: time-boxed, owner-approved only, with expiry and compensating controls. Expired waivers reopen findings. No standing waiver for P1-R1 through P1-R5.

---

## Pre-Check (Phase 1 candidate)

Run against the exact candidate Q filed. Viewports for any public HTML inspection: 1440 and 390. Record candidate id, commit or restore point, and date on the verdict line.

### 1. No public admin traces (P1-R1)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Public nav and footer | No ADMIN, Vauxhall, portal, or Haus-admin control visible to a non-admin session on the public marketing surface | Any admin affordance in nav, footer, or chrome |
| Page source | Public HTML, JS bundles referenced from public pages, and inline scripts contain zero portal route strings that reveal admin existence as a public affordance (no /vauxhall links, no "Admin" labels, no admin CTAs) | Admin label, /vauxhall href, or portal CTA in public source |
| Sitemap | Public sitemap omits /vauxhall and any admin-only paths | Admin path listed |
| robots | robots.txt does not Disallow admin paths in a way that names the portal; public robots must not advertise portal existence | robots names portal or admin paths as a discovery hint |
| Live regression | Known live fail (2026-09-15 survey): visible ADMIN on https://bond-rosin-vapes.vercel.app/ sourced from Home.dc.html must be gone before any Phase 1 public clearance | ADMIN still visible on public live URL or still present in Home.dc.html |

### 2. 404 cloaking, never 403 (P1-R2)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Non-admin /vauxhall | Unauthenticated and non-admin sessions receive HTTP 404 on /vauxhall and every portal deep link | 200, 301/302 to a portal surface, 401, or 403 |
| Response body | 404 body matches the Bond cloaked 404 (not a portal shell, not a "forbidden" page, not a default host 404 that differs from other unknown routes in a revealing way once Bond cloaked 404 exists) | Body admits a portal or differs in a way that fingerprints admin routes |
| Direct deep links | Nested portal routes under /vauxhall return the same cloaked 404 to non-admin | Any deep link returns 403 or portal UI |
| /haus non-admin | Non-admin at /haus sees only Bond Haus sign-in, never portal chrome | Portal frame or wing stubs leak on Haus |

### 3. MFA required (P1-R3)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Enrollment | Every admin account in the candidate seed or auth config has MFA required | Any admin without MFA enforced |
| Sign-in path | Completing password (or primary factor) alone cannot establish an admin session | Session or /vauxhall access granted without MFA challenge |
| Bypass | No code path, feature flag, or env toggle disables MFA for admin in the candidate | MFA skip, "dev bypass", or optional MFA for admin |
| Acceptance 2 | Admin sign-in without MFA is impossible under test | Test account reaches portal without MFA |

### 4. Audit log immutability (P1-R4)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Schema | audit_log is insert-only at the database level (no update or delete grants for app roles) | App role can UPDATE or DELETE audit rows |
| Write on action | Every admin action under test writes who, what, before, after, when, from where | Missing fields or silent actions |
| Tamper | Attempted edit or delete of an audit row fails | Row mutable |
| Export | Log is searchable and exportable for owner review (Phase 1 minimum: queryable append stream) | No readable audit trail for admin actions |

### 5. Access shell integrity (P1-R5 to P1-R8)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Role claim | Admin gate reads server-verified role (Supabase Auth / RLS), not localStorage, cookie flag, or client-only claim | Client flag alone opens /vauxhall |
| Shared accounts | Seed and docs forbid shared admin credentials; one human per admin account | Shared or generic admin user |
| Idle expiry | Sessions expire at 24 hours idle | Idle session lasts beyond 24 hours with no reauth |
| Rate limit | Sign-in rate limit with lockout and alerting is present and testable | Unlimited credential stuffing path with no lockout |

### 6. Copy and dash lint on portal strings (standing Felix surface)

| Check | Pass criterion | Fail if |
| --- | --- | --- |
| Em dash / en dash | Zero U+2014 and U+2013 in portal UI strings, seeds, and code comments touched by the candidate | Any em or en dash |
| Claims | No health, therapeutic, or medical claims on Haus or portal chrome | Any such claim |

---

## Verdict line (file to JB and M)

Format:

`date | candidate-id | Phase 1 Pre-Check PASS or FAIL | failed rule ids if any | restore point | Felix`

FAIL must list each failed check with exact surface and criterion. PASS requires evidence notes (routes probed, MFA test account path, audit insert proof).

---

## Standing public block (until remediated)

Until P1-R1 passes on the public marketing surface, Felix withholds public clearance for that surface. Live finding 2026-09-15: visible ADMIN link in Home.dc.html (Design Canvas static site). Phase 1 adds Next.js without rewriting marketing pages and must neutralize that trace. JB holds the remediation route. Gary already has the recommendation. No ship.
