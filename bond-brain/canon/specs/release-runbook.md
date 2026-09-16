# Release runbook

Owner: M
Status: standing
Filed: 2026-09-15
Source directive: /inbox/06-m-release-runbook.md

M holds the licence to ship. Nothing reaches production without the three preconditions below. Agents recommend. They never assume Gary's go.

## Preconditions (all required)

1. Vesper PASS on the exact release candidate, with receipts filed to JB and M.
2. Felix clearance current for that candidate (NY OCM checklist and any platform rules that apply to the ship surface), dated and filed under /canon/specs/.
3. Gary's explicit go, relayed through JB, quoted verbatim in /log/shipped.md.

Missing any one item: no ship.

## M ship precondition (Prompt 2E, advisory)

Named for Phase B plumbing. Advisory until M enablement. Not a hard gate in this PR.

At ship time the candidate should show:

1. Pre-Check green
2. Monitors green
3. Metrc sync green (Trace mock / Phase A seam only)

Hard gate waits for a later enablement PR after Felix + M PASS. Live paging and auto-actions stay off until that PR.

Rollback named for this stream: `dpl_DnCSsFcNmXDYLwD1mQJcBWckvbg9` (PR15 live tip).

## Candidate path

1. Q places a candidate in /queue/release-candidates/ with a restore point named.
2. Vesper inspects against mockups (1440 and 390), the active spec acceptance list, and standing lints. Verdict is PASS with evidence or FAIL with the exact element, criterion, and receipt. FAIL returns to Q. No soft passes.
3. Felix confirms clearance is current for the ship surface. Appeals go to Gary through JB only.
4. M verifies environment state (below) matches the intended ship mode.
5. JB relays Gary's go. M quotes it verbatim into /log/shipped.md and ships.
6. M confirms post-ship health. On degradation: revert first, investigate second.

## Environment state (M owns)

Document live values here when set. Secrets stay out of the vault; store references only.
Awareness logged 2026-09-15 from Gary via JB. No ship. See also /canon/specs/deployment.md.

| Control | Current | Notes |
| --- | --- | --- |
| Public marketing site | https://bond-rosin-vapes.vercel.app/ (Vercel) | Project `bond-rosin-vapes` (`prj_t57zdACUUpzxtYcfZdAlrTTySxyH`) on ViaConnect team (`team_5RxMf7ArmgUgzcqXDUwTiTvJ`). GitHub `garyferenczi74-svg/Bond-Rosin-Vapes`. Latest prod READY `dpl_2b3CbZzqkPAcKxUdWSYBfpfk9ZVP` (2026-08-21, sha `1aebaed`). Alias also: bond-rosin-vapes-via-connect.vercel.app. |
| Admin portal (Vauxhall) | Phase 1 greenlit (build) | Spec: /canon/specs/prompt-2-vauxhall.md. Gary greenlit Phase 1 access shell (Bond Haus + Vauxhall frame) 2026-09-15 via JB. Expect RC. No ship until Vesper PASS, Felix clearance, Gary go via JB. |
| Staging access / passwords | TBD (ref only) | Rotate on handoff. Never commit plaintext. |
| robots / indexing | off until Gary flips launch | Unchanged. Robots stay off until Gary flips launch. |
| Locator | waitlist until Gary flips live | Unchanged. Toggle is waitlist or live. |
| Domain wiring | Vercel app URL above; custom domain TBD | Confirm DNS and TLS before any launch flip. |
| Age gate | on every route | Felix standing rule. Deep links must block. |

Ship mode defaults: robots off, locator on waitlist, indexing off. Gary alone flips launch and locator live. Phase 1 build is greenlit; production ship still requires the three preconditions.

## Gary go (exact wording)

Acceptable go is an explicit production release instruction from Gary, relayed by JB, naming the candidate.

Required shape (JB must pass all of these through):
- Who: Gary
- What: ship / release to production (not "looks good", not "ship when ready")
- Which: the candidate id or path
- When: now, or a named window that is not a Friday afternoon

M quotes the go verbatim in the shipped line. Paraphrase is not a go. Silence is not a go. A prior go for a different candidate is not a go.

Example shipped line after a valid go:

`2026-09-15 | rc-homepage-v1 | Vesper PASS | Felix clear 2026-09-15 | "Ship rc-homepage-v1 to production now." — Gary via JB | restore: staging@abc123`

## Friday afternoon ban

M ships nothing on a Friday afternoon, ever, and says so with pride.

- Friday afternoon means after 12:00 local (America/New_York) on any Friday.
- A go that lands in that window is logged and held until Monday morning unless Gary names a different non-Friday window in a new go.
- Emergency rollback is always allowed. Rollback is not a ship.

## Rollback

Every release logs its restore point in /log/shipped.md.

On production degradation:
1. Revert to the logged restore point immediately.
2. Confirm health on the restored surface.
3. Notify JB (and Vesper if the fail looks like a QC miss).
4. Investigate second. No forward fix in production without a new candidate, new Vesper PASS, current Felix clearance, and a new Gary go.

## Shipped log

Append-only file: /log/shipped.md

Format: `date | candidate | Vesper | Felix | Gary go (verbatim) | restore point`

Header notes in that file point here. No edits to prior lines.

## Decision log

Consequential release policy changes get one line in /log/decisions.md: date, decision, reasoning, approved by.
