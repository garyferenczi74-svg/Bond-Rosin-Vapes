"use client";

import { useEffect, useState } from "react";
import type { AdminRole } from "@/lib/tokens";
import { tokens } from "@/lib/tokens";
import { downloadJson } from "@/lib/vauxhall/csv";
import type { VauxhallStore } from "@/lib/vauxhall/store";
import type { FindingSeverity, MonitorId, RuleGroup } from "@/lib/vauxhall/types";
import { RULE_GROUPS } from "@/lib/vauxhall/types";
import { ConsoleHeader, SeedBanner } from "./console-chrome";
import { Metric } from "./metric";
import { useVauxhallStore } from "./use-store";

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", color: "#E1DAD0", fontSize: 13 }}>
        {title}
      </div>
      <div style={{ overflow: "auto" }}>{children}</div>
    </div>
  );
}

function Scorecard({ store }: { store: VauxhallStore }) {
  const card = store.scorecard();
  return (
    <div className="vx-metrics">
      <Metric label="P0 (30d)" value={String(card.p0_30d)} sub="Standing target zero" />
      <Metric label="P1 (30d)" value={String(card.p1_30d)} sub="Standing target zero" />
      <Metric label="Open findings" value={String(card.open)} sub="Cite. Remediate. Document." />
      <Metric label="Dev-side escapes (30d)" value={String(card.escapes_30d)} sub="Honesty metric" />
    </div>
  );
}

function DemoBar({
  store,
  owner,
  onToast,
}: {
  store: VauxhallStore;
  owner: boolean;
  onToast: (msg: string) => void;
}) {
  const [triggerId, setTriggerId] = useState<MonitorId>("content-lint");
  const monitors = store.listMonitors();

  function toggleLive() {
    if (owner === false) {
      onToast("Demo Live is an owner toggle.");
      return;
    }
    store.setDemoLive(store.demoLive === false);
    onToast(store.demoLive ? "Demo Live on. Scheduler ticking." : "Demo Live frozen.");
  }

  function fireTrigger() {
    if (owner === false) {
      onToast("Demo Trigger is an owner control.");
      return;
    }
    store.triggerMonitorFailure(triggerId);
    onToast(`Demo Trigger fired ${triggerId}. No external call.`);
  }

  function tamper() {
    if (owner === false) {
      onToast("Tamper Test is an owner control.");
      return;
    }
    store.tamperAudit();
    onToast("Tamper Test broke the mock chain.");
  }

  function resetChain() {
    if (owner === false) {
      onToast("Reset is an owner control.");
      return;
    }
    store.resetAuditChain();
    onToast("Mock chain restored.");
  }

  return (
    <div className="vx-demo-bar">
      <span className="lbl" style={{ margin: 0 }}>
        Demo
      </span>
      <button type="button" className="vx-chip" onClick={toggleLive} disabled={owner === false}>
        <span className="vx-dot" style={{ color: store.demoLive ? "#79C84A" : "#8E887C" }} />
        {store.demoLive ? "Demo Live on" : "Demo Live frozen"}
      </button>
      {store.demoLive === false ? (
        <>
          <label className="lbl" style={{ margin: 0 }} htmlFor="demo-trigger">
            Trigger
          </label>
          <select
            id="demo-trigger"
            className="field"
            style={{ width: "auto", minWidth: 180, padding: "6px 10px", fontSize: 12 }}
            value={triggerId}
            disabled={owner === false}
            onChange={(ev) => setTriggerId(ev.target.value as MonitorId)}
          >
            {monitors.map((mon) => (
              <option key={mon.id} value={mon.id}>
                {mon.name}
              </option>
            ))}
          </select>
          <button type="button" className="vx-act" onClick={fireTrigger} disabled={owner === false}>
            Fire
          </button>
        </>
      ) : (
        <span style={{ fontSize: 12, color: "#8E887C" }}>Scheduler ticking. Scripted lint and lockout run on their own.</span>
      )}
      <button type="button" className="vx-act" onClick={tamper} disabled={owner === false}>
        Tamper Test
      </button>
      <button type="button" className="vx-act" onClick={resetChain} disabled={owner === false}>
        Reset
      </button>
    </div>
  );
}

export function SecurityWing({
  consoleId,
  role,
  onToast,
}: {
  consoleId?: string;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const store = useVauxhallStore();
  const active = consoleId ?? "monitors";
  const owner = role === "owner";
  const banner = store.p0Banner();

  useEffect(() => {
    store.ensureStandingSecurityChecks();
  }, [store]);

  return (
    <div>
      <SeedBanner ink={tokens.security} />
      {banner ? <div className="vx-p0">{banner}</div> : null}
      <Scorecard store={store} />
      <DemoBar store={store} owner={owner} onToast={onToast} />
      {active === "monitors" ? <MonitorsView store={store} /> : null}
      {active === "findings" ? <FindingsView store={store} onToast={onToast} /> : null}
      {active === "incidents" ? <IncidentsView store={store} /> : null}
      {active === "rules" ? <RulesView store={store} owner={owner} onToast={onToast} /> : null}
      {active === "waivers" ? <WaiversView store={store} /> : null}
      {active === "audit-log" ? <AuditLogView store={store} owner={owner} onToast={onToast} /> : null}
      {active === "dsar" ? <DsarView store={store} /> : null}
      {active === "vendors" ? <VendorsView store={store} /> : null}
      {active === "dashboards" ? <SecurityDashView store={store} /> : null}
      {active === "scanner-bridge" ? <ScannerView store={store} /> : null}
      {active === "pre-check" ? <PreCheckView store={store} onToast={onToast} /> : null}
      {active === "soc-2-exporter" ? <Soc2View store={store} onToast={onToast} /> : null}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  return (
    <div className="vx-spark" aria-hidden="true">
      {values.map((value, index) => (
        <i key={`${index}-${value}`} className={value >= 1 ? "on" : value >= 0.5 ? "mid" : ""} style={{ height: `${8 + value * 20}px` }} />
      ))}
    </div>
  );
}

function MonitorsView({ store }: { store: VauxhallStore }) {
  const monitors = store.listMonitors();
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = monitors.find((item) => item.id === openId);
  const rule = selected ? store.listRules().find((item) => item.id === selected.ruleId) : undefined;

  return (
    <div>
      <ConsoleHeader
        title="Monitors"
        subtitle="Fourteen monitors. Cite. Remediate. Document. Felix owns the catalog."
      />
      <div className="vx-monitor-grid">
        {monitors.map((mon) => (
          <button
            key={mon.id}
            type="button"
            className="card vx-ink-card"
            style={{ ["--wing-ink" as string]: tokens.security, textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
            onClick={() => setOpenId((id) => (id === mon.id ? null : mon.id))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#E1DAD0", fontSize: 14 }}>{mon.name}</span>
              <span className="vx-pill" style={{ cursor: "default" }}>
                {mon.state}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8E887C" }}>
              {mon.cadence} . Last {mon.lastRun} . Next {mon.nextRun}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#B0A99A" }}>{mon.citation}</p>
            <Sparkline values={mon.sparkline} />
          </button>
        ))}
      </div>
      {selected ? (
        <article className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.security, marginTop: 12 }}>
          <p className="lbl">Run history</p>
          <p style={{ margin: "8px 0 0", color: "#E1DAD0" }}>{selected.name}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8E887C" }}>
            Rule {rule?.name ?? selected.ruleId} . {selected.citation}
          </p>
          {selected.history.length === 0 ? (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>No ticks yet. Frozen until Demo Live or Trigger.</p>
          ) : (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B0A99A", fontSize: 13 }}>
              {selected.history.map((run) => (
                <li key={run.id}>
                  {run.at} . {run.state} . {run.note}
                  {run.findingId ? ` . ${run.findingId}` : ""}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}
    </div>
  );
}

function FindingsView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const findings = store.listFindings();
  const [closeId, setCloseId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");

  function close(id: string) {
    const result = store.closeFinding(id, evidence);
    if (result.ok === false) {
      onToast(result.reason);
      return;
    }
    onToast(`Finding ${id} closed.`);
    setCloseId(null);
    setEvidence("");
  }

  return (
    <div>
      <ConsoleHeader title="Findings" subtitle="Cite. Remediate. Document. Every row is that record." />
      <div className="vx-toolbar">
        {(["P0", "P1", "P2", "P3"] as FindingSeverity[]).map((pill) => (
          <span key={pill} className="vx-pill" style={{ cursor: "default" }}>
            {pill} {findings.filter((item) => item.severity === pill).length}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {findings.map((finding) => (
          <article
            key={finding.id}
            className="card vx-ink-card"
            style={{ ["--wing-ink" as string]: tokens.security }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#E1DAD0", fontSize: 14 }}>
                {finding.severity} . {finding.surface}
              </span>
              <span className="vx-pill" style={{ cursor: "default" }}>
                {finding.state}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8E887C" }}>
              {finding.source}
              {finding.monitorId ? ` . Monitor ${finding.monitorId}` : ""} . {finding.citation} . Owner {finding.owner} . Due{" "}
              {finding.due}
            </p>
            <div className="vx-cite-grid">
              <div>
                <p className="lbl">Cite</p>
                <p>{finding.cite}</p>
              </div>
              <div>
                <p className="lbl">Remediate</p>
                <p>{finding.remediate}</p>
              </div>
              <div>
                <p className="lbl">Document</p>
                <p>{finding.document}</p>
              </div>
            </div>
            {finding.closedEvidence ? (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8E887C" }}>Close: {finding.closedEvidence}</p>
            ) : (
              <div style={{ marginTop: 12 }}>
                {closeId === finding.id ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <label className="lbl" htmlFor={`ev-${finding.id}`}>
                      Closure evidence
                    </label>
                    <textarea
                      id={`ev-${finding.id}`}
                      className="field"
                      rows={3}
                      value={evidence}
                      onChange={(ev) => setEvidence(ev.target.value)}
                      placeholder="Evidence text is required."
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="vx-act" onClick={() => close(finding.id)}>
                        Close with evidence
                      </button>
                      <button type="button" className="vx-act" onClick={() => setCloseId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="vx-act" onClick={() => { setCloseId(finding.id); setEvidence(""); }}>
                    Close
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function IncidentsView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Incidents" subtitle="What happened, not what might. Timeline, impact, root cause." />
      <div style={{ display: "grid", gap: 10 }}>
        {store.listIncidents().map((incident) => (
          <article key={incident.id} className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.security }}>
            <div style={{ color: "#E1DAD0", fontSize: 14 }}>{incident.title}</div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>{incident.timeline}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#B0A99A" }}>Impact: {incident.impact}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#B0A99A" }}>Actions: {incident.actions}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#B0A99A" }}>Root cause: {incident.rootCause}</p>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8E887C" }}>
              Linked findings {(incident.linkedFindingIds ?? [incident.findingId]).join(", ")} . {incident.rollbackStub}
            </p>
            {incident.beats && incident.beats.length ? (
              <ol style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B0A99A", fontSize: 13 }}>
                {incident.beats.map((beat, index) => (
                  <li key={`${incident.id}-${beat.kind}-${index}`}>
                    {beat.kind} . {beat.note}
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function RulesView({
  store,
  owner,
  onToast,
}: {
  store: VauxhallStore;
  owner: boolean;
  onToast: (msg: string) => void;
}) {
  const rules = store.listRules();
  const [editId, setEditId] = useState<string | null>(null);
  const [citation, setCitation] = useState("");
  const [enforcement, setEnforcement] = useState("");

  function startEdit(id: string) {
    const rule = rules.find((item) => item.id === id);
    if (rule === undefined) return;
    setEditId(id);
    setCitation(rule.citation);
    setEnforcement(rule.enforcement);
  }

  function save() {
    if (editId === null) return;
    if (owner === false) {
      onToast("Rule edits are an owner action.");
      return;
    }
    const ok = typeof window === "undefined" ? true : window.confirm("Record this rule edit to the audit log.");
    if (ok === false) return;
    const result = store.editRule(editId, { citation, enforcement });
    onToast(result.ok ? "Rule updated." : result.reason);
    if (result.ok) setEditId(null);
  }

  return (
    <div>
      <ConsoleHeader title="Rules" subtitle="The enforced ruleset as data. Citations travel with the row." />
      {RULE_GROUPS.map((group: RuleGroup) => (
        <TableCard key={group} title={group}>
          <table className="vx-data">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Citation</th>
                <th>Monitors</th>
                <th>Findings</th>
                <th>Gate</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {rules
                .filter((rule) => (rule.group ?? "platform") === group)
                .map((rule) => {
                  const locked = rule.group === "agent conduct" || rule.editable === false;
                  const history = store.findingsForRule(rule.id);
                  return (
                    <tr key={rule.id}>
                      <td style={{ color: "#E1DAD0" }}>{rule.name}</td>
                      <td>{rule.citation}</td>
                      <td>{(rule.monitorIds ?? []).join(", ") || "none"}</td>
                      <td>{history.length}</td>
                      <td>{rule.gate}</td>
                      <td>
                        {locked ? (
                          <span style={{ color: "#8E887C" }}>Read-only in Phase A. Changes route through Felix and counsel.</span>
                        ) : (
                          <button type="button" className="vx-act" onClick={() => startEdit(rule.id)} disabled={owner === false}>
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </TableCard>
      ))}
      {editId ? (
        <article className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.security }}>
          <p className="lbl">Owner edit</p>
          <label className="lbl" htmlFor="rule-cite">
            Citation
          </label>
          <input id="rule-cite" className="field" value={citation} onChange={(ev) => setCitation(ev.target.value)} />
          <label className="lbl" htmlFor="rule-enf" style={{ marginTop: 10 }}>
            Enforcement
          </label>
          <input id="rule-enf" className="field" value={enforcement} onChange={(ev) => setEnforcement(ev.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="vx-act" onClick={save}>
              Confirm edit
            </button>
            <button type="button" className="vx-act" onClick={() => setEditId(null)}>
              Cancel
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}

function WaiversView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Waivers" subtitle="Time-boxed owner exceptions. Expired waivers reopen the finding." />
      <TableCard title="Register">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Waiver</th>
              <th>Rule</th>
              <th>Finding</th>
              <th>Scope</th>
              <th>Expiry</th>
              <th>Control</th>
              <th>Stamp</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {store.listWaivers().map((waiver) => (
              <tr key={waiver.id}>
                <td style={{ color: "#E1DAD0" }}>{waiver.id}</td>
                <td>{waiver.ruleId ?? "unset"}</td>
                <td>{waiver.findingId}</td>
                <td>{waiver.scope ?? waiver.control}</td>
                <td>{waiver.expiresOn}</td>
                <td>{waiver.control}</td>
                <td>{waiver.ownerStamp ?? "unset"}</td>
                <td>{waiver.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function AuditLogView({
  store,
  owner,
  onToast,
}: {
  store: VauxhallStore;
  owner: boolean;
  onToast: (msg: string) => void;
}) {
  const rows = store.listAudit();
  const verify = store.verifyAuditChain();

  return (
    <div>
      <ConsoleHeader
        title="Audit Log"
        subtitle="Append-only hash chain. Verify walks the mock ledger."
        right={
          <>
            <button
              type="button"
              className="vx-act"
              onClick={() => onToast(verify.ok ? "Verify Chain green." : `Verify failed at ${verify.brokenAt}.`)}
            >
              Verify Chain
            </button>
            <button
              type="button"
              className="vx-act"
              disabled={owner === false}
              onClick={() => {
                store.tamperAudit();
                onToast("Tamper Test broke the mock chain.");
              }}
            >
              Tamper Test
            </button>
            <button
              type="button"
              className="vx-act"
              disabled={owner === false}
              onClick={() => {
                store.resetAuditChain();
                onToast("Mock chain restored.");
              }}
            >
              Reset
            </button>
          </>
        }
      />
      <p style={{ margin: "0 0 12px", fontSize: 13, color: verify.ok ? "#B0A99A" : "#A53A28" }}>
        {verify.ok ? "Chain verify green." : `Chain verify failed at ${verify.brokenAt}.`}
      </p>
      <TableCard title="Portal actions">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Note</th>
              <th>Hash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.time}</td>
                <td style={{ color: "#E1DAD0" }}>{row.actor}</td>
                <td>{row.action}</td>
                <td>{row.target}</td>
                <td>{row.note}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{row.hash ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function DsarView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="DSAR" subtitle="Data subject requests against Bond Circle. The clock is visible." />
      {store.listDsar().map((item) => (
        <article key={item.id} className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.security }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "#E1DAD0" }}>{item.subject}</span>
            <span className="vx-pill" style={{ cursor: "default" }}>
              {item.state}
            </span>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>{item.clock}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#B0A99A" }}>{item.note}</p>
        </article>
      ))}
    </div>
  );
}

function VendorsView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Vendors" subtitle="DPAs here. Bond has no health data and no BAA regime." />
      <TableCard title="Register">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Scope</th>
              <th>DPA</th>
              <th>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {store.listVendors().map((vendor) => (
              <tr key={vendor.id}>
                <td style={{ color: "#E1DAD0" }}>{vendor.name}</td>
                <td>{vendor.scope}</td>
                <td>{vendor.dpa}</td>
                <td>{vendor.renewal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function SecurityDashView({ store }: { store: VauxhallStore }) {
  const card = store.scorecard();
  const findings = store.listFindings();
  const trends = store.dashboardSecurityTrends();
  return (
    <div>
      <ConsoleHeader title="Dashboards" subtitle="Trend view over findings, MTTR, and monitor uptime. Mock window only." />
      <div className="vx-metrics vx-metrics-3">
        <Metric label="Opened 90d" value={String(trends.opened90)} sub="Findings opened versus closed" />
        <Metric label="Closed 90d" value={String(trends.closed90)} sub="This seed" />
        <Metric label="Escapes" value={String(card.escapes_30d)} sub="The honesty metric." />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#8E887C" }}>
        Escapes trendline stays at zero. The honesty metric.
      </p>
      <TableCard title="MTTR by severity">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            {trends.mttr.map((row) => (
              <tr key={row.severity}>
                <td style={{ color: "#E1DAD0" }}>{row.severity}</td>
                <td>{row.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Monitor uptime league">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Monitor</th>
              <th>Uptime</th>
            </tr>
          </thead>
          <tbody>
            {trends.uptime.map((row) => (
              <tr key={row.id}>
                <td style={{ color: "#E1DAD0" }}>{row.name}</td>
                <td>{row.pct} percent</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Closure ledger">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Finding</th>
              <th>Severity</th>
              <th>Opened</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.id}>
                <td style={{ color: "#E1DAD0" }}>{finding.id}</td>
                <td>{finding.severity}</td>
                <td>{finding.openedOn}</td>
                <td>{finding.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function ScannerView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Scanner Bridge" subtitle="Code and dependency output flowing into Findings." />
      <TableCard title="Inbound">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Source</th>
              <th>Note</th>
              <th>Last sweep</th>
              <th>Finding</th>
            </tr>
          </thead>
          <tbody>
            {store.listScanner().map((item) => (
              <tr key={item.id}>
                <td style={{ color: "#E1DAD0" }}>{item.source}</td>
                <td>{item.note}</td>
                <td>{item.lastSweep ?? "unset"}</td>
                <td>{item.findingId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function PreCheckView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const checks = store.listPreChecks();
  const [candidate, setCandidate] = useState("rc-118");

  function run() {
    const result = store.runPreCheck(candidate);
    onToast(
      result.verdict === "green"
        ? `${candidate} Pre-Check green.`
        : `${candidate} blocked. ${result.reasons[0] ?? "Rule cited."}`,
    );
  }

  function fix() {
    store.applyPreCheckFix(candidate);
    onToast("Fix Applied. Run again.");
  }

  return (
    <div>
      <ConsoleHeader
        title="Pre-Check"
        subtitle="M will not take a candidate until this gate is green. Includes Metrc sync freshness from Trace."
        right={
          <>
            <label className="lbl" htmlFor="pc-rc" style={{ margin: 0 }}>
              Candidate
            </label>
            <select
              id="pc-rc"
              className="field"
              style={{ width: "auto", minWidth: 140, padding: "6px 10px", fontSize: 12 }}
              value={candidate}
              onChange={(ev) => setCandidate(ev.target.value)}
            >
              <option value="rc-117">rc-117</option>
              <option value="rc-118">rc-118</option>
            </select>
            <button type="button" className="vx-act" onClick={run}>
              Run
            </button>
            <button type="button" className="vx-act" onClick={fix} disabled={candidate === "rc-118" ? false : true}>
              Fix Applied
            </button>
          </>
        }
      />
      <div style={{ display: "grid", gap: 10 }}>
        {checks.map((check) => {
          const mAllows = store.mGateAllows(check.candidate);
          return (
            <article
              key={check.id}
              className="card vx-ink-card"
              style={{ ["--wing-ink" as string]: tokens.security }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "#E1DAD0" }}>{check.candidate}</span>
                <span className="vx-pill" style={{ cursor: "default" }}>
                  {check.verdict}
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>
                M gate: {mAllows ? "cleared" : "refused until green"}
              </p>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B0A99A", fontSize: 13 }}>
                {check.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Soc2View({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  function exportEvidence() {
    const pack = store.soc2EvidencePack();
    downloadJson(pack.filename, pack.json);
    onToast("Mock SOC 2 evidence pack exported.");
  }
  return (
    <div>
      <ConsoleHeader
        title="SOC 2 Exporter"
        subtitle="Control families with mapped evidence sources. Mock file. Not a live attestation."
        right={
          <button type="button" className="vx-act" onClick={exportEvidence}>
            Export Evidence Pack
          </button>
        }
      />
      <TableCard title="Control map">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Family</th>
              <th>Control</th>
              <th>Coverage</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>
            {store.listSoc2().map((row) => (
              <tr key={row.id}>
                <td style={{ color: "#E1DAD0" }}>{row.family ?? row.control}</td>
                <td>{row.control}</td>
                <td>{row.coverage ?? 0} percent</td>
                <td>{(row.sources ?? [row.evidence]).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
