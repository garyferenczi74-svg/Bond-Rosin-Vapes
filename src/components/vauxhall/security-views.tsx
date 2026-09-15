"use client";

import { tokens } from "@/lib/tokens";
import { csvFilename, downloadCsv } from "@/lib/vauxhall/csv";
import type { VauxhallStore } from "@/lib/vauxhall/store";
import type { FindingSeverity } from "@/lib/vauxhall/types";
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

export function SecurityWing({
  consoleId,
  onToast,
}: {
  consoleId?: string;
  onToast: (msg: string) => void;
}) {
  const store = useVauxhallStore();
  const active = consoleId ?? "findings";
  return (
    <div>
      <SeedBanner ink={tokens.security} />
      <Scorecard store={store} />
      {active === "findings" ? <FindingsView store={store} /> : null}
      {active === "incidents" ? <IncidentsView store={store} /> : null}
      {active === "rules" ? <RulesView store={store} /> : null}
      {active === "waivers" ? <WaiversView store={store} /> : null}
      {active === "audit-log" ? <AuditLogView store={store} /> : null}
      {active === "dsar" ? <DsarView store={store} /> : null}
      {active === "vendors" ? <VendorsView store={store} /> : null}
      {active === "dashboards" ? <SecurityDashView store={store} /> : null}
      {active === "scanner-bridge" ? <ScannerView store={store} /> : null}
      {active === "pre-check" ? <PreCheckView store={store} /> : null}
      {active === "soc-2-exporter" ? <Soc2View store={store} onToast={onToast} /> : null}
    </div>
  );
}

function FindingsView({ store }: { store: VauxhallStore }) {
  const findings = store.listFindings();
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
              {finding.source} . {finding.citation} . Owner {finding.owner} . Due {finding.due}
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
            ) : null}
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
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8E887C" }}>Spawned finding {incident.findingId}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function RulesView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Rules" subtitle="The enforced ruleset as data. Citations travel with the row." />
      <TableCard title="Ruleset">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Citation</th>
              <th>Enforcement</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            {store.listRules().map((rule) => (
              <tr key={rule.id}>
                <td style={{ color: "#E1DAD0" }}>{rule.name}</td>
                <td>{rule.citation}</td>
                <td>{rule.enforcement}</td>
                <td>{rule.gate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
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
              <th>Finding</th>
              <th>Expiry</th>
              <th>Control</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {store.listWaivers().map((waiver) => (
              <tr key={waiver.id}>
                <td style={{ color: "#E1DAD0" }}>{waiver.id}</td>
                <td>{waiver.findingId}</td>
                <td>{waiver.expiresOn}</td>
                <td>{waiver.control}</td>
                <td>{waiver.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function AuditLogView({ store }: { store: VauxhallStore }) {
  const rows = store.listAudit();
  return (
    <div>
      <ConsoleHeader title="Audit Log" subtitle="Append-only. Searchable in this mock. Immutable by design." />
      <TableCard title="Portal actions">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Note</th>
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
  return (
    <div>
      <ConsoleHeader title="Dashboards" subtitle="Trend view over findings and closure. Mock window only." />
      <div className="vx-metrics vx-metrics-3">
        <Metric label="Closed" value={String(findings.filter((item) => item.state === "closed").length)} sub="This seed" />
        <Metric label="Open P1" value={String(card.p1_30d)} sub="30 day window" />
        <Metric label="Escapes" value={String(card.escapes_30d)} sub="Honesty metric" />
      </div>
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
              <th>Finding</th>
            </tr>
          </thead>
          <tbody>
            {store.listScanner().map((item) => (
              <tr key={item.id}>
                <td style={{ color: "#E1DAD0" }}>{item.source}</td>
                <td>{item.note}</td>
                <td>{item.findingId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function PreCheckView({ store }: { store: VauxhallStore }) {
  const checks = store.listPreChecks();
  return (
    <div>
      <ConsoleHeader
        title="Pre-Check"
        subtitle="M will not take a candidate until this gate is green."
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
    downloadCsv(`bond-soc2-mock-${csvFilename()}`, store.soc2Export());
    onToast("Mock SOC 2 evidence exported.");
  }
  return (
    <div>
      <ConsoleHeader
        title="SOC 2 Exporter"
        subtitle="One click evidence map. Mock file. Not a live attestation."
        right={
          <button type="button" className="vx-act" onClick={exportEvidence}>
            Export evidence
          </button>
        }
      />
      <TableCard title="Control map">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Control</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {store.listSoc2().map((row) => (
              <tr key={row.id}>
                <td style={{ color: "#E1DAD0" }}>{row.control}</td>
                <td>{row.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}
