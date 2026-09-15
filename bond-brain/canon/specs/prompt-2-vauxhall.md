# Prompt 2: Vauxhall
Version: 2026-09-15 (ingested from Gary attachment via JB)
Source: Gary attachment 2026-09-15 (Prompt 2 docx)
Status: ingested as design canon for admin portal. Not a production release.

B O N D
PROMPT 2: VAUXHALL
The Hidden Bond Admin Portal: Command Center, Mini-ERP, Security Wing, Social Desk
Prepared for Gary Ferenczi, CedarGrowth / Bond Vapes
July 22, 2026

Builds on: Prompt 1 (the Section: JB, Q, Moneypenny, Vesper, M, Felix, Carver), Framer Build Spec v1.0, locked brand tokens.
Entity note: The reference routes supplied were ViaConnect patterns. Bond is a separate entity; all routes, agent names, and consoles below are Bond-native equivalents. Marshall-pattern capabilities live under Felix here; nothing links to or shares infrastructure with any other portfolio property.
1. Access Model: Invisible Until It Isn't
The portal does not exist for anyone who is not an admin.
    • Public sign-in surface: Bond Haus, the members entry at /haus. Visitors and future Bond Circle members see only the Haus sign-in.
    • The trigger: when submitted credentials match an admin account, the same sign-in routes the session to /vauxhall. No admin link exists anywhere: not in navigation, sitemap, robots, or page source. Admin routes requested by a non-admin session return 404, never 403; a portal that answers "forbidden" admits it exists.
    • Stack: this activates the reserved Next.js application layer (the Framer marketing site stays untouched). Next.js App Router plus Supabase Auth with row level security; admin is a server-verified role claim, never a client flag. Deployed on Vercel under the same domain via subpath routing, or haus subdomain if cleaner at DNS.
    • Hard requirements: MFA mandatory for every admin account. Sessions expire at 24 hours idle. Sign-in rate limited with lockout and alerting. Every admin action writes to an append-only audit log (who, what, before, after, when, from where). Two roles at launch: owner (Gary: full control including user management and destructive actions) and operator (read plus approve within assigned wings). No shared accounts, ever.
    • Admin UI design language: the house system in working clothes. Matte Black #1B1D1C surfaces, Deep Charcoal #2A2A2A cards, Bone #E1DAD0 type, Aptos for all UI, GFS Didot reserved for wing titles only, accent hairlines for wing identity (Vauxhall bone, ERP No. 1 green ink, Security No. 3 oxide ink, Social No. 2 blue ink). Dense but never cluttered; a control room, not a dashboard theme park.
2. Wing 1: Vauxhall Command Center (agent observability)
The room where the Section is visible. Everything the seven agents do, decide, recommend, and learn, live.
Navigation: Live Feed, Agents, Review, Queue, Steering, Evolution, Knowledge.
    • Live Feed: real-time event stream from all agents, filterable by agent and event type. The event taxonomy is fixed so every module speaks one language: Ingestion, Knowledge, Update, Agent Decision, Self-Tune, Evolution, Report, Advisor, Insight, Interaction, Alert, Population, Trend, Error, Escalation, Research Task. Each event: timestamp, agent, type, one-line summary, expandable detail, link to source artifact. An All Data view exposes the raw stream with export.
    • Agents: the roster board. One card per agent (JB, Q, Moneypenny, Vesper, M, Felix, Carver): status (active, idle, blocked), current task, last ten events, error count 24 h, and that agent's open recommendations. Blocked states surface their blocker.
    • Review: the decision inbox. Agent recommendations and proposed fixes awaiting Gary, each with the recommending agent, evidence links, JB's endorsement or dissent, and one-tap approve, reject, or send back with a note. Daily audits land here: JB's end-of-day digest of decisions taken, anomalies, and tomorrow's plan.
    • Queue: the two pipelines side by side: release-candidates (build, Vesper verdict, Felix clearance, M status) and social-drafts (script, Felix clearance, awaiting Gary). Items move visibly through their gates.
    • Steering: write directives into /inbox from the portal: freeform directive plus optional target agent, priority, and due date. What Gary types here is what JB decomposes.
    • Evolution: the self-tune ledger. Every Self-Tune and Evolution event with before and after behavior, the trigger, and rollback control. Agents may propose their own tuning; applying it is an owner action.
    • Knowledge: the canon browser. Read and search everything in /canon with version history. Edits route through the Moneypenny approval flow; no silent canon changes even from the portal.
3. Wing 2: Product (the mini-ERP)
Bond's commercial spine: wholesale-first, since Bond sells through licensed dispensaries.
Routes: Dashboard, Board Metrics, Unit Economics, SKU Portfolio, Alerts and Risks, Inventory, Orders, Accounts.
    • Dashboard: today at a glance: open orders and their stages, units on hand by SKU, units in process, week's shipments, sales month to date against plan, top five accounts by velocity.
    • Orders and order schedule: full order lifecycle: draft, confirmed, in fulfillment, shipped, delivered, paid. Calendar and list views of the schedule; each order carries account, lines by SKU and batch, promised date, and documents. Late orders escalate to Alerts automatically.
    • Stock: on-hand inventory by SKU and batch lot, each lot carrying batch number, COA link, package dates, and location. Reserved versus available split so promised stock cannot be double-sold.
    • Stock in process: production runs: pressing and filling runs with stage (fresh frozen, washed, pressed, filled, packaged, ready), expected yield, expected completion, and conversion into stock lots on completion. This is where "what can we promise and when" gets answered.
    • Accounts (add new customers): the wholesale book: licensed dispensary accounts with license number and expiry (blocking: no orders against an expired license), contacts, terms, order history, velocity, and notes. New account intake form with license verification as a required step.
    • Sales overview, Board Metrics, and Unit Economics: revenue by SKU, account, and region across time; sell-in versus reorder rate (the health metric that matters most in year one); Reserve Edition run performance; gross margin per unit by SKU with cost inputs editable by owner only; a board view formatted to drop into a CedarGrowth update without rework.
    • SKU Portfolio: the catalog as data: the three numbers plus any future No. 4, each with tokens, triad, batch history, and lifecycle state. Adding a SKU here is the single act that propagates everywhere else.
    • Alerts and Risks: low stock against velocity, aging lots, late production runs, license expiries inside 60 days, receivables aging, and anything Vesper or Felix flags with commercial impact.
4. Wing 3: Security and Compliance (Felix's wing)
Runtime plus Claude Code enforcement. The working motto carries over: Cite. Remediate. Document.
Scorecard, pinned at the top: P0 findings (30 d), P1 findings (30 d), Open findings, Dev-side escapes (30 d). The standing target for the first three is zero and the fourth is the honesty metric: anything that reached runtime without being caught dev-side gets a root cause entry, no exceptions.
Routes: Findings, Incidents, Rules, Waivers, Audit Log, DSAR, Vendors, Dashboards, Scanner Bridge, Pre-Check, SOC 2 Exporter.
    • Findings: every security or compliance finding: severity (P0 to P3), source (runtime monitor, code scan, dependency audit, Felix review, manual), affected surface, citation to the rule or regulation violated, remediation owner and due date, and closure evidence. Cite. Remediate. Document. is the record structure, literally.
    • Incidents: anything that happened rather than might: timeline, impact, actions, root cause, and the finding it spawned. M's rollbacks link here automatically.
    • Rules: the enforced ruleset as data: web security headers and CSP, age-gate integrity checks, claims-language lint, dash lint, dependency and secret policies, and the Claude Code enforcement set (what agents may never do: touch production, alter canon silently, publish social, modify this ruleset). Rules carry citations; enforcement runs at pre-check and runtime.
    • Waivers: time-boxed, owner-approved exceptions with expiry and compensating controls. Expired waivers reopen their findings automatically.
    • Audit Log: the append-only record of every admin and agent action portal-wide, searchable, exportable, immutable.
    • DSAR: data subject requests against Bond Circle data: intake, identity verification, fulfillment or deletion, and the clock. Bond holds little personal data by design; this proves it on demand.
    • Vendors: the vendor register with data processing agreements, scopes, and renewal dates (DPAs here; Bond has no health data and no BAA regime, which is itself worth documenting once).
    • Scanner Bridge: the integration point for code and dependency scanning output flowing into Findings automatically.
    • Pre-Check: the pre-deploy gate M consumes: a release candidate cannot reach M's desk until Pre-Check passes rules, scans, age-gate tests, and claims lint. Green or blocked, with reasons.
    • Dashboards and SOC 2 Exporter: trend views over findings and closure times, and a one-click evidence export mapped to SOC 2 controls, because the day a major MSO or banking partner asks, the answer is a file, not a scramble.
5. Wing 4: Social (Carver's desk, with hands on it)
The Prompt 1 content loop, given a room. Nothing here changes the chain: Carver drafts, Felix clears, Gary approves, then and only then it schedules.
Routes: Overview, Content, Create, Auto-Script, Research, Scriptwriter, Editor, Scheduler, Analyzer, Post Tracking.
    • Overview: the desk at a glance: live status strips in the style Gary specified, for example Scriptwriter LIVE Drafting: 10 hook variations for the current concept; Editor LIVE Last approved: Morning Routine, 3 edits flagged; Scheduler LIVE 12 posts queued for the next 7 days, optimal window 6:30 PM weekdays; Analyzer Processing 30-day engagement data across 6 platforms. These strips are real states, not decoration.
    • Research: Carver's Scout territory map and viral ledger surfaced: tracked posts with format, hook type, performance, remix-fit score against the brand test, and provenance links. Positive content only, per the Felix originality rule.
    • Auto-Script and Scriptwriter: concept in, variations out: hooks, shot lists drawn from the Film Day asset library, captions in the house voice, platform variants. Every generated script carries its ledger provenance. Live drafting shows variations side by side for selection.
    • Create and manual mode: Gary or an operator writes a script or post by hand. Manual work is never exempt: the agent audit runs on every manual draft (voice check, forbidden vocabulary, claims lint, dash lint, originality check) and attaches its findings before the draft can enter the approval chain. Human hands, same standards.
    • Editor: the approval room: Felix's clearance or rejection with reasons, flagged edits inline, Gary's approve or send-back, and the full chain recorded per draft.
    • Scheduler: approved posts only. Queue across platforms, optimal-window recommendations from the Analyzer, blackout controls, and a hard rule: an unapproved post cannot be scheduled by any account, including owner, without generating a P1 finding in Felix's wing.
    • Analyzer and Post Tracking: performance per post at 48 hours and 30 days, engagement across connected platforms, hook-type league tables feeding back into Research, and the compounding loop: what works enters canon through Moneypenny.
6. Data Model (Supabase, append-only migrations)
Core tables: admins (role, mfa, status), audit_log, agent_events (the taxonomy), recommendations, directives, canon_versions, orders, order_lines, accounts, inventory_lots, production_runs, skus, findings, incidents, rules, waivers, dsar_requests, vendors, social_ledger, social_drafts, social_schedule, social_metrics. All tables RLS-enforced by role; audit_log and agent_events insert-only at the database level.
7. Build Order
    • 1. Phase 1: Access shell: Bond Haus sign-in, admin trigger, 404 cloaking, MFA, audit log, portal frame with the four wings stubbed.
    • 2. Phase 2: Vauxhall Command Center on the live agent event stream, plus Steering and Review, because visibility and control come before everything.
    • 3. Phase 3: Product wing: SKU Portfolio and Inventory first, then Orders and Accounts, then the economics views.
    • 4. Phase 4: Security wing: Findings, Rules, Pre-Check wired into M's release gate, then the remainder.
    • 5. Phase 5: Social wing on the Prompt 1 pipeline, Scheduler last so nothing can be scheduled before the approval chain exists in software.
8. Acceptance
    • 1. A non-admin session receives 404 on every portal route, including direct deep links, with zero portal traces in public source, sitemap, or robots.
    • 2. Admin sign-in without MFA is impossible; audit log captures every action with before and after state.
    • 3. The Live Feed renders agent events in real time and the Review queue round-trips an approval end to end.
    • 4. An order cannot be created against an expired dispensary license; reserved stock cannot be double-allocated.
    • 5. Pre-Check blocks a seeded violation and M's gate refuses the candidate until it clears.
    • 6. An unapproved social post cannot reach the Scheduler by any path without raising a P1 finding.
    • 7. Adding a No. 4 SKU in SKU Portfolio propagates to Inventory, Orders, and reporting with no code changes.
    • 8. Zero em-dashes or en-dashes anywhere in the portal: UI strings, seeds, code comments, and logs.

Google Drive upload link: https://drive.google.com/drive/folders/15EQPv4JIdPHoTF0wsg85MYntrH3cFW4F?usp=drive_link
