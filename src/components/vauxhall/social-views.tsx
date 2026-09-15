"use client";

import { useState } from "react";
import { tokens } from "@/lib/tokens";
import type { VauxhallStore } from "@/lib/vauxhall/store";
import type { SocialPipelineItem } from "@/lib/vauxhall/types";
import { ConsoleHeader, SeedBanner } from "./console-chrome";
import { Metric } from "./metric";
import { useVauxhallStore } from "./use-store";

function PipelineCard({ item }: { item: SocialPipelineItem }) {
  return (
    <article className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.social }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#E1DAD0", fontSize: 14 }}>{item.title}</span>
        <span className="vx-pill" style={{ cursor: "default", color: tokens.social, borderColor: tokens.social }}>
          {item.stage}
        </span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#8E887C" }}>
        {item.kind} . {item.desk}
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "#B0A99A" }}>{item.note}</p>
      {item.auditFlags.length ? (
        <div className="vx-toolbar" style={{ marginTop: 10, marginBottom: 0 }}>
          {item.auditFlags.map((flag) => (
            <span key={flag} className="vx-pill" style={{ cursor: "default" }}>
              {flag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function SocialWing({
  consoleId,
  onToast,
}: {
  consoleId?: string;
  onToast: (msg: string) => void;
}) {
  const store = useVauxhallStore();
  const active = consoleId ?? "overview";
  return (
    <div>
      <SeedBanner ink={tokens.social} />
      {active === "overview" ? <Overview store={store} /> : null}
      {active === "content" ? <ContentQueue store={store} /> : null}
      {active === "create" ? <CreateDesk store={store} onToast={onToast} /> : null}
      {active === "auto-script" || active === "scriptwriter" ? <ScriptDesk store={store} /> : null}
      {active === "research" ? <ResearchDesk store={store} /> : null}
      {active === "editor" ? <EditorDesk store={store} onToast={onToast} /> : null}
      {active === "scheduler" ? <SchedulerDesk /> : null}
      {active === "analyzer" || active === "post-tracking" ? <AnalyzerDesk store={store} /> : null}
    </div>
  );
}

function Overview({ store }: { store: VauxhallStore }) {
  const strips = store.listDeskStrips();
  const queue = store.listSocialPipeline();
  return (
    <div>
      <ConsoleHeader
        title="Overview"
        subtitle="Carver drafts. Felix clears. Gary approves. Scheduler stays parked."
      />
      <div className="vx-strip-stack">
        {strips.map((strip) => (
          <div key={strip.id} className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.social }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#E1DAD0" }}>{strip.title}</span>
              <span className="vx-pill" style={{ cursor: "default", color: tokens.social, borderColor: tokens.social }}>
                {strip.state}
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#8E887C" }}>{strip.line}</p>
          </div>
        ))}
      </div>
      <p className="lbl" style={{ margin: "18px 0 10px" }}>
        Pipeline
      </p>
      <div className="vx-mosaic">
        {queue.map((item) => (
          <PipelineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ContentQueue({ store }: { store: VauxhallStore }) {
  const queue = store.listSocialPipeline();
  return (
    <div>
      <ConsoleHeader title="Content" subtitle="Draft cards in the approval chain. Nothing publishes from here." />
      <div className="vx-metrics vx-metrics-3">
        <Metric label="In queue" value={String(queue.length)} sub="Mock pipeline" />
        <Metric
          label="Approved"
          value={String(queue.filter((item) => item.approved).length)}
          sub="Still not scheduled"
        />
        <Metric
          label="Held"
          value={String(queue.filter((item) => item.stage === "held").length)}
          sub="Audit flags attached"
        />
      </div>
      <div className="vx-mosaic">
        {queue.map((item) => (
          <PipelineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function CreateDesk({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const manuals = store.listSocialPipeline().filter((item) => item.kind === "Manual");

  function submit() {
    const item = store.addManualDraft(title, body);
    setTitle("");
    setBody("");
    onToast(`Audit attached to ${item.id}.`);
  }

  return (
    <div>
      <ConsoleHeader
        title="Create"
        subtitle="Manual mode. The agent audit still runs. Human hands, same standards."
      />
      <div className="card" style={{ marginBottom: 16, maxWidth: 720 }}>
        <label>
          <span className="lbl">Title</span>
          <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <span className="lbl">Script</span>
          <textarea
            className="field"
            rows={5}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="House voice. No claims. No dashes."
            style={{ marginTop: 8, resize: "vertical" }}
          />
        </label>
        <button type="button" className="vx-act" style={{ marginTop: 14 }} onClick={submit}>
          Run audit and hold
        </button>
      </div>
      <div className="vx-mosaic">
        {manuals.map((item) => (
          <PipelineCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ScriptDesk({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader
        title="Scriptwriter"
        subtitle="Concept in, variations out. Ledger provenance on every line. Auto-Script shares this desk."
      />
      <div className="vx-mosaic">
        {store.listVariations().map((item) => (
          <article key={item.id} className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.social }}>
            <p className="lbl" style={{ margin: 0 }}>
              {item.platform}
            </p>
            <p style={{ margin: "10px 0 0", color: "#E1DAD0" }}>{item.hook}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#B0A99A" }}>{item.caption}</p>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8E887C" }}>{item.provenance}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ResearchDesk({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader title="Research" subtitle="Scout territory map. Positive content only. No scrape yet." />
      <div className="card" style={{ padding: 0 }}>
        <table className="vx-data">
          <thead>
            <tr>
              <th>Format</th>
              <th>Hook</th>
              <th>Remix fit</th>
              <th>Provenance</th>
            </tr>
          </thead>
          <tbody>
            {store.listResearch().map((row) => (
              <tr key={row.id}>
                <td style={{ color: "#E1DAD0" }}>{row.format}</td>
                <td>{row.hook}</td>
                <td>{row.remixFit}</td>
                <td>
                  {row.provenance} . {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditorDesk({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const queue = store.listSocialPipeline().filter((item) => item.stage === "felix" || item.stage === "owner");
  return (
    <div>
      <ConsoleHeader title="Editor" subtitle="Felix clearance, then owner. The chain is recorded per draft." />
      <div style={{ display: "grid", gap: 10 }}>
        {queue.map((item) => (
          <div key={item.id}>
            <PipelineCard item={item} />
            <div style={{ display: "flex", gap: 8, margin: "8px 0 0" }}>
              {item.stage === "felix" ? (
                <button
                  type="button"
                  className="vx-act"
                  onClick={() => {
                    store.clearSocialDraft(item.id, "felix");
                    onToast("Felix cleared.");
                  }}
                >
                  Felix clear
                </button>
              ) : null}
              <button
                type="button"
                className="vx-act"
                onClick={() => {
                  store.clearSocialDraft(item.id, "owner");
                  onToast("Owner approved. Scheduler still parked.");
                }}
              >
                Owner approve
              </button>
              <button
                type="button"
                className="vx-act"
                onClick={() => {
                  store.sendBackDraft(item.id, "Send back. Hold for voice.");
                  onToast("Sent back.");
                }}
              >
                Send back
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchedulerDesk() {
  return (
    <div>
      <ConsoleHeader
        title="Scheduler"
        subtitle="Parked. Prompt 2C stays parked for real Carver publish."
      />
      <div className="card vx-parked">
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Parked
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#B0A99A", lineHeight: 1.6 }}>
          Live publish is out of scope. Scheduler and Prompt 2C stay parked. The Social shell shows
          mock pipeline cards only. Nothing schedules from this desk.
        </p>
      </div>
    </div>
  );
}

function AnalyzerDesk({ store }: { store: VauxhallStore }) {
  return (
    <div>
      <ConsoleHeader
        title="Analyzer"
        subtitle="48 hour and 30 day loop. Mock numbers only. Post Tracking shares this desk. No scrape yet."
      />
      <div className="vx-social-metrics">
        <Metric label="Tasks completed" value="--" sub="No scrape yet" />
        <Metric
          label="Posts in queue"
          value={String(store.listSocialPipeline().length)}
          sub="Mock pipeline"
        />
        <Metric label="Engagement" value="--" sub="No scrape yet" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", color: "#E1DAD0", fontSize: 13 }}>
          Social performance
        </div>
        <table className="vx-data">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Posts</th>
              <th>Reach</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {store.listSocialMetrics().map((row) => (
              <tr key={row.platform}>
                <td style={{ color: "#E1DAD0" }}>{row.platform}</td>
                <td>{row.posts}</td>
                <td>{row.reach}</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
