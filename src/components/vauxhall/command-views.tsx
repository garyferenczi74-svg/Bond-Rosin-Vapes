"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { csvFilename, downloadCsv, eventsToCsv } from "@/lib/vauxhall/csv";
import type { VauxhallStore } from "@/lib/vauxhall/store";
import type { AgentEvent, AgentStatus, EventType, ReviewItem } from "@/lib/vauxhall/types";
import { AGENTS, TYPE_PILLS } from "@/lib/vauxhall/types";

const GATES = ["Vesper", "Felix", "M", "Owner"] as const;

function statusColor(status: AgentStatus): string {
  if (status === "Blocked") return "#A53A28";
  if (status === "Verifying") return "#E1DAD0";
  return "#79C84A";
}

function isHotType(type: string): boolean {
  return type === "Alert" || type === "Escalation" || type === "Error";
}

function typeBadge(type: string) {
  const hot = isHotType(type);
  return (
    <span
      className="vx-pill"
      style={hot ? { borderColor: "#A53A28", color: "#A53A28", cursor: "default" } : { cursor: "default" }}
    >
      {type}
    </span>
  );
}

function ViewHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 22,
      }}
    >
      <div>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>{subtitle}</p>
      </div>
      {right ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{right}</div> : null}
    </header>
  );
}

export function LiveFeedView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const events = store.listEvents();
  const { filter, live } = store;
  const [openId, setOpenId] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) {
    seen.current = new Set(events.map((event) => event.id));
  }

  useEffect(() => {
    for (const event of events) seen.current?.add(event.id);
  }, [events]);

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function copyAudit(audit: string) {
    if (navigator.clipboard) navigator.clipboard.writeText(audit);
    onToast(`Audit id ${audit} copied.`);
  }

  function exportCurrent() {
    downloadCsv(csvFilename(), eventsToCsv(events));
    onToast(`Exported ${events.length} events.`);
  }

  const queue = store.listQueue();

  return (
    <div>
      <div className="vx-metrics">
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Events
          </p>
          <div className="vx-metric-value">{events.length}</div>
          <p className="vx-metric-sub">{filter.agent || filter.type ? "Filtered set" : "Mock seed stream"}</p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Open review
          </p>
          <div className="vx-metric-value">{store.openReviewCount()}</div>
          <p className="vx-metric-sub">Awaiting owner</p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Queue
          </p>
          <div className="vx-metric-value">{queue.rcs.length + queue.drafts.length}</div>
          <p className="vx-metric-sub">
            {queue.rcs.length} candidates . {queue.drafts.length} drafts
          </p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Feed
          </p>
          <div className="vx-metric-value">{live ? "Live" : "Hold"}</div>
          <p className="vx-metric-sub">Design preview mock</p>
        </div>
      </div>

      <ViewHeader
        title="Live Feed"
        subtitle="Filter by agent and event type. Expand a row for source and audit."
        right={
          <>
            <button type="button" className="vx-chip" onClick={() => store.setLive(!live)}>
              <span className="vx-dot" style={{ color: live ? "#79C84A" : "#8E887C" }} />
              {live ? "Live" : "Paused"}
            </button>
            <button type="button" className="vx-primary" onClick={exportCurrent}>
              Export
            </button>
          </>
        }
      />

      <div className="vx-toolbar">
        {AGENTS.map((agent) => {
          const summary = store.agentSummary(agent);
          return (
            <button
              key={agent}
              type="button"
              className={`vx-chip${filter.agent === agent ? " active" : ""}`}
              onClick={() => store.toggleAgent(agent)}
            >
              <span className="vx-dot" style={{ color: statusColor(summary.status) }} />
              {agent} <span style={{ color: "#8E887C" }}>{summary.status}</span>
            </button>
          );
        })}
      </div>

      <div className="vx-toolbar">
        <button
          type="button"
          className={`vx-pill${filter.type ? "" : " active"}`}
          onClick={() => store.setType(null)}
        >
          All events
        </button>
        {TYPE_PILLS.map((type) => (
          <button
            key={type}
            type="button"
            className={`vx-pill${filter.type === type ? " active" : ""}`}
            onClick={() => store.setType(type as EventType)}
          >
            {type}
          </button>
        ))}
        <button
          type="button"
          className={`vx-pill${filter.allData ? " active" : ""}`}
          style={{ marginLeft: "auto" }}
          onClick={() => store.toggleAllData()}
        >
          All Data
        </button>
      </div>

      {filter.allData ? (
        <div style={{ overflow: "auto" }}>
          <table className="vx-data">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Type</th>
                <th>Summary</th>
                <th>Subline</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{event.time}</td>
                  <td style={{ color: "#E1DAD0" }}>{event.agent}</td>
                  <td>{event.type}</td>
                  <td style={{ color: "#E1DAD0" }}>{event.summary}</td>
                  <td>{event.sub}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {events.map((event) => (
            <FeedRow
              key={event.id}
              event={event}
              entering={!seen.current?.has(event.id)}
              open={openId === event.id}
              onToggle={() => setOpenId((id) => (id === event.id ? null : event.id))}
              onCopy={copyAudit}
            />
          ))}
          {events.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6E685E" }}>No events match this filter.</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FeedRow({
  event,
  entering,
  open,
  onToggle,
  onCopy,
}: {
  event: AgentEvent;
  entering: boolean;
  open: boolean;
  onToggle: () => void;
  onCopy: (audit: string) => void;
}) {
  return (
    <div>
      <button type="button" className={`vx-event${entering ? " enter" : ""}`} onClick={onToggle}>
        <span className={`vx-event-rule${isHotType(event.type) ? " hot" : ""}`} aria-hidden="true" />
        <div style={{ color: "#8E887C", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{event.time}</div>
        <div>
          <span style={{ color: "#E1DAD0" }}>{event.agent}</span>
          <div className="etype" style={{ marginTop: 6 }}>
            {typeBadge(event.type)}
          </div>
        </div>
        <div>
          <div style={{ color: "#E1DAD0" }}>{event.summary}</div>
          <div style={{ fontSize: 12, color: "#8E887C", marginTop: 4 }}>{event.sub}</div>
        </div>
      </button>
      {open ? (
        <div className="vx-event-detail">
          <div style={{ lineHeight: 1.7 }}>{event.sub}</div>
          <div style={{ marginTop: 8 }}>
            Source artifact:{" "}
            <Link href="/vauxhall/live-feed" style={{ color: "#B0A99A", borderBottom: "1px solid #33352F" }}>
              artifact/{event.id}
            </Link>
            {" . "}
            Audit <span style={{ fontVariantNumeric: "tabular-nums" }}>{event.audit}</span>{" "}
            <button type="button" className="vx-act" style={{ padding: "4px 9px", marginLeft: 6 }} onClick={() => onCopy(event.audit)}>
              Copy
            </button>
            {event.type === "Alert" ? (
              <Link href="/vauxhall/security" style={{ marginLeft: 14, color: "#B0A99A", borderBottom: "1px solid #33352F" }}>
                View in Security wing
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AgentsView({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ViewHeader title="Agents" subtitle="The roster board. Status, task, and open recommendations per agent." />
      <div className="vx-mosaic">
        {store.roster().map((agent) => (
          <div key={agent.name} className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 19, color: "#E1DAD0", letterSpacing: "0.02em" }}>
                {agent.name}
              </span>
              <span className="vx-chip" style={{ cursor: "default" }}>
                <span className="vx-dot" style={{ color: statusColor(agent.status) }} />
                {agent.status}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#B0A99A", marginTop: 12 }}>{agent.task}</div>
            {agent.blocker ? (
              <div style={{ fontSize: 12, color: "#A53A28", marginTop: 6 }}>Blocker: {agent.blocker}</div>
            ) : null}
            <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 11.5, color: "#6E685E" }}>
              <span>Errors 24h: {agent.errors}</span>
              <span>Open recs: {agent.recs}</span>
            </div>
            <div style={{ borderTop: "1px solid #2A2A2A", marginTop: 12, paddingTop: 8 }}>
              <div className="lbl" style={{ marginBottom: 4 }}>
                Last events
              </div>
              {agent.events.length ? (
                agent.events.map((event) => (
                  <div key={event.id} style={{ display: "flex", gap: 10, fontSize: 12, color: "#8E887C", padding: "4px 0" }}>
                    <span style={{ color: "#5E5A52", minWidth: 56, fontVariantNumeric: "tabular-nums" }}>{event.time}</span>
                    <span>{event.type}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: "#5E5A52" }}>None recorded</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  store,
  onToast,
}: {
  item: ReviewItem;
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="vx-review">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <span style={{ color: "#E1DAD0", fontSize: 14 }}>{item.title}</span>
        <span style={{ display: "flex", gap: 6 }}>
          <span className="vx-pill" style={{ cursor: "default" }}>
            Open
          </span>
          <span className="vx-pill" style={{ cursor: "default" }}>
            {item.agent}
          </span>
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: "#8E887C", marginTop: 8 }}>Evidence: {item.evidence}</div>
      <div style={{ fontSize: 12.5, color: "#79C84A", marginTop: 4 }}>{item.endorse}</div>
      <input
        className="field"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note for send back"
        style={{ marginTop: 12, fontSize: 13, padding: "10px 12px" }}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className="vx-act"
          onClick={() => {
            store.resolveReview(item.id, "approved");
            onToast("Approved.");
          }}
        >
          Approve
        </button>
        <button
          type="button"
          className="vx-act"
          onClick={() => {
            store.resolveReview(item.id, "rejected");
            onToast("Rejected.");
          }}
        >
          Reject
        </button>
        <button
          type="button"
          className="vx-act"
          onClick={() => {
            store.resolveReview(item.id, "sent back", note.trim());
            onToast("Sent back.");
          }}
        >
          Send back with note
        </button>
      </div>
    </div>
  );
}

export function ReviewView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const open = store.listReview().filter((item) => item.state === "open");
  return (
    <div>
      <div className="vx-metrics">
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Open
          </p>
          <div className="vx-metric-value">{open.length}</div>
          <p className="vx-metric-sub">Awaiting owner</p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Resolved
          </p>
          <div className="vx-metric-value">{store.listReview().length - open.length}</div>
          <p className="vx-metric-sub">This session</p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Daily audit
          </p>
          <div className="vx-metric-value">Seed</div>
          <p className="vx-metric-sub">Prototype digest</p>
        </div>
        <div className="vx-metric">
          <p className="lbl" style={{ margin: 0 }}>
            Badge
          </p>
          <div className="vx-metric-value">{store.openReviewCount()}</div>
          <p className="vx-metric-sub">Shown on Review tab</p>
        </div>
      </div>
      <ViewHeader title="Review" subtitle="The decision inbox. Approve, reject, or send back with a note." />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {open.length === 0 ? (
          <div className="card" style={{ textAlign: "center", color: "#6E685E" }}>
            The queue is clear. Nothing awaits you.
          </div>
        ) : (
          open.map((item) => <ReviewCard key={item.id} item={item} store={store} onToast={onToast} />)
        )}
      </div>
    </div>
  );
}

export function QueueView({ store }: { store: VauxhallStore }) {
  const queue = store.listQueue();
  const [openId, setOpenId] = useState<string | null>(null);
  const weekly = store.weeklyAudit();
  const ship117 = store.shipPrecondition("rc-117");
  const ship118 = store.shipPrecondition("rc-118");

  return (
    <div>
      <ViewHeader title="Queue" subtitle="Release candidates and social drafts moving through their gates." />
      <article className="card vx-ink-card" style={{ ["--wing-ink" as string]: "#A53A28", marginBottom: 14 }}>
        <p className="lbl">M ship precondition</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8E887C" }}>{store.shipPreconditionText()}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#B0A99A" }}>
          rc-117 {ship117.ready ? "signals green" : `missing ${ship117.missing.join(", ")}`} . rc-118{" "}
          {ship118.ready ? "signals green" : `missing ${ship118.missing.join(", ")}`}
        </p>
      </article>
      <article className="card" style={{ marginBottom: 14 }}>
        <p className="lbl">{weekly.title}</p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8E887C" }}>
          Queue item. {weekly.cadence}. Owner {weekly.owner}. {weekly.note}
        </p>
      </article>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "15px 16px", borderBottom: "1px solid #2A2A2A", color: "#E1DAD0", fontSize: 12.5 }}>
            Release candidates
          </div>
          {queue.rcs.map((rc) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => setOpenId((id) => (id === rc.id ? null : rc.id))}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "15px 16px",
                border: "none",
                borderBottom: "1px solid #2A2A2A",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#E1DAD0" }}>{rc.title}</span>
                <span style={{ color: "#6E685E", fontVariantNumeric: "tabular-nums" }}>{rc.id}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", marginTop: 12 }}>
                {GATES.map((gate, index) => (
                  <div key={gate} style={{ display: "flex", alignItems: "center", flex: index < GATES.length - 1 ? 1 : 0 }}>
                    <span
                      className={`vx-stepdot${index < rc.stage ? " done" : index === rc.stage ? " now" : ""}`}
                    />
                    {index < GATES.length - 1 ? <span className={`vx-stepbar${index < rc.stage ? " done" : ""}`} /> : null}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, color: "#6E685E" }}>
                {GATES.map((gate) => (
                  <span key={gate}>{gate}</span>
                ))}
              </div>
              {openId === rc.id ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#8E887C", borderTop: "1px solid #2A2A2A", paddingTop: 10 }}>
                  {rc.note}
                </div>
              ) : null}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "15px 16px", borderBottom: "1px solid #2A2A2A", color: "#E1DAD0", fontSize: 12.5 }}>
            Social drafts
          </div>
          {queue.drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => setOpenId((id) => (id === draft.id ? null : draft.id))}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "15px 16px",
                border: "none",
                borderBottom: "1px solid #2A2A2A",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#E1DAD0" }}>{draft.title}</span>
                <span className="vx-pill" style={{ borderColor: "#A53A28", color: "#A53A28", cursor: "default" }}>
                  Blocked
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#6E685E", marginTop: 5 }}>
                {draft.kind} . {draft.blocker}
              </div>
              {openId === draft.id ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "#8E887C", borderTop: "1px solid #2A2A2A", paddingTop: 10 }}>
                  {draft.kind} . {draft.blocker}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SteeringView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [due, setDue] = useState("");

  function submit() {
    if (!text.trim()) {
      onToast("Write a directive first.");
      return;
    }
    store.submitDirective(text, target, priority, due);
    setText("");
    setTarget("");
    setPriority("Normal");
    setDue("");
    onToast("Directive filed.");
  }

  return (
    <div>
      <ViewHeader title="Steering" subtitle="Write directives into the inbox. What you type is what JB decomposes." />
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="lbl">Directive</div>
        <textarea
          className="field"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write the directive. JB decomposes it into tasks."
          style={{ marginTop: 8, resize: "vertical" }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <div>
            <div className="lbl">Target agent</div>
            <select className="field" value={target} onChange={(event) => setTarget(event.target.value)} style={{ marginTop: 8 }}>
              <option value="">JB decides</option>
              {AGENTS.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="lbl">Priority</div>
            <select className="field" value={priority} onChange={(event) => setPriority(event.target.value)} style={{ marginTop: 8 }}>
              <option>Normal</option>
              <option>High</option>
              <option>Low</option>
            </select>
          </div>
          <div>
            <div className="lbl">Due date</div>
            <input className="field" type="date" value={due} onChange={(event) => setDue(event.target.value)} style={{ marginTop: 8 }} />
          </div>
        </div>
        <button type="button" className="vx-act" style={{ marginTop: 16, padding: "12px 28px" }} onClick={submit}>
          File directive
        </button>
      </div>
    </div>
  );
}

export function EvolutionView({ store, onToast }: { store: VauxhallStore; onToast: (msg: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div>
      <ViewHeader title="Evolution" subtitle="The self-tune ledger. Applying a tuning is an owner action." />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {store.listTuning().map((item) => (
          <div key={item.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: "#E1DAD0", fontSize: 15 }}>{item.proposal}</span>
              <span>
                {item.agent} .{" "}
                <span className="vx-pill" style={{ cursor: "default" }}>
                  {item.state === "applied" ? "Applied" : item.state === "rejected" ? "Rejected" : "Proposed"}
                </span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div className="lbl">Before</div>
                <div style={{ fontSize: 13, color: "#8E887C", marginTop: 5 }}>{item.before}</div>
              </div>
              <div>
                <div className="lbl">After</div>
                <div style={{ fontSize: 13, color: "#B0A99A", marginTop: 5 }}>{item.after}</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "#6E685E", marginTop: 10 }}>Trigger: {item.trigger}</div>
            {item.state === "proposed" ? (
              <div>
                <input
                  className="field"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Reject note (optional)"
                  style={{ marginTop: 12, fontSize: 13, padding: "10px 12px" }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <button
                    type="button"
                    className="vx-act"
                    onClick={() => {
                      store.applyTuning(item.id);
                      onToast("Tuning applied.");
                    }}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="vx-act"
                    onClick={() => {
                      store.rejectTuning(item.id, note);
                      onToast("Recorded.");
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : null}
            {item.state === "applied" ? (
              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                <button
                  type="button"
                  className="vx-act"
                  onClick={() => {
                    store.rollbackTuning(item.id);
                    onToast("Rolled back.");
                  }}
                >
                  Roll back
                </button>
                <span style={{ fontSize: 12, color: "#6E685E" }}>Applied . rollback available</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KnowledgeView({ store }: { store: VauxhallStore }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("brand-tokens");
  const [version, setVersion] = useState<"current" | "prior">("current");
  const searchRef = useRef<HTMLInputElement>(null);
  const docs = store.listCanon().filter((doc) => doc.name.includes(query.toLowerCase()));
  const current = docs.find((doc) => doc.id === selected) ?? docs[0];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!current) return null;

  return (
    <div>
      <ViewHeader
        title="Knowledge"
        subtitle="Prototype canon. Mock contents only. Edits would route through Moneypenny."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(200px, 260px) 1fr",
          gap: 0,
          border: "1px solid #232323",
          borderRadius: 2,
          overflow: "hidden",
        }}
        className="vx-knowledge"
      >
        <div style={{ borderRight: "1px solid #2A2A2A", padding: 16, background: "#2A2A2A" }}>
          <input
            ref={searchRef}
            className="field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search canon . press /"
            style={{ marginBottom: 12, padding: "10px 12px", fontSize: 13 }}
          />
          {docs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                setSelected(doc.id);
                setVersion("current");
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderRadius: 2,
                background: doc.id === current.id ? "#2A2A2A" : "transparent",
                color: doc.id === current.id ? "#E1DAD0" : "#8E887C",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
              }}
            >
              {doc.name}
            </button>
          ))}
        </div>
        <div style={{ padding: 24, background: "#1B1D1C" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 20, color: "#E1DAD0", letterSpacing: "0.02em" }}>
              {current.name}
            </div>
            <select
              className="field"
              value={version}
              onChange={(event) => setVersion(event.target.value as "current" | "prior")}
              style={{ width: "auto", padding: "8px 12px" }}
            >
              <option value="current">{current.ver} current</option>
              <option value="prior">prior</option>
            </select>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.9, color: "#B0A99A", marginTop: 16 }}>
            {version === "current" ? current.body : current.prior}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .vx-knowledge { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
