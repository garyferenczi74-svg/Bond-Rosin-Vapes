import Link from "next/link";
import type { WingId } from "@/lib/tokens";
import { tokens, wings } from "@/lib/tokens";
import { WING_CONSOLES } from "@/lib/vauxhall/routes";

const PRODUCT_NUMBERS = [
  { id: "no-1", name: "No. 1", note: "Prototype SKU. Specs stay in canon." },
  { id: "no-2", name: "No. 2", note: "Prototype SKU. Specs stay in canon." },
  { id: "no-3", name: "No. 3", note: "Prototype SKU. Specs stay in canon." },
] as const;

const SOCIAL_DESKS = [
  { id: "scriptwriter", title: "Scriptwriter", state: "Framed", note: "Drafting stays parked." },
  { id: "editor", title: "Editor", state: "Framed", note: "Clearance stays parked." },
  { id: "scheduler", title: "Scheduler", state: "Framed", note: "No unapproved schedule path." },
  { id: "analyzer", title: "Analyzer", state: "Framed", note: "No scrape connected." },
] as const;

const SOCIAL_ROWS = [
  { platform: "TikTok", note: "No scrape yet" },
  { platform: "Instagram", note: "No scrape yet" },
  { platform: "YouTube", note: "No scrape yet" },
] as const;

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="vx-metric">
      <p className="lbl" style={{ margin: 0 }}>
        {label}
      </p>
      <div className="vx-metric-value">{value}</div>
      <p className="vx-metric-sub">{sub}</p>
    </div>
  );
}

export function WingMosaic({
  id,
  consoleId,
}: {
  id: Exclude<WingId, "command">;
  consoleId?: string;
}) {
  const wing = wings.find((item) => item.id === id);
  if (!wing) return null;
  if (id === "product") return <ProductMosaic consoleId={consoleId} />;
  if (id === "security") return <SecurityMosaic consoleId={consoleId} />;
  return <SocialMosaic consoleId={consoleId} />;
}

function ProductMosaic({ consoleId }: { consoleId?: string }) {
  const consoles = WING_CONSOLES.product;
  const active = consoleId ?? consoles[0]?.id;

  return (
    <div>
      <div className="card" style={{ marginBottom: 10 }}>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Board metrics
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#8E887C", lineHeight: 1.6 }}>
          Board metrics stay empty until a finance snapshot is connected. No invented SKU prices
          or investor figures.
        </p>
      </div>

      <div className="vx-mosaic" style={{ marginBottom: 10 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#E1DAD0", fontSize: 13 }}>Catalog</span>
            <span className="lbl" style={{ margin: 0 }}>
              3 SKUs
            </span>
          </div>
          {PRODUCT_NUMBERS.map((sku) => (
            <div
              key={sku.id}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #232323",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: "#E1DAD0", fontSize: 13 }}>{sku.name}</div>
                <div style={{ color: "#8E887C", fontSize: 12, marginTop: 4 }}>{sku.note}</div>
              </div>
              <span className="vx-pill" style={{ cursor: "default", color: tokens.product, borderColor: tokens.product }}>
                Framed
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <p className="lbl" style={{ margin: "0 0 8px" }}>
            Orders
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>No orders yet.</p>
        </div>
      </div>

      <div className="vx-mosaic" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 8px" }}>
            Alerts
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>No live operational alerts.</p>
        </div>
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 8px" }}>
            Inventory
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>
            No warehouse snapshot connected. Demand and safety stock are not generated.
          </p>
        </div>
      </div>

      <p className="lbl" style={{ margin: "0 0 10px" }}>
        Consoles
      </p>
      <div className="vx-tiles">
        {consoles.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`vx-tile${item.id === active ? " on" : ""}`}
            style={{ ["--wing-ink" as string]: tokens.product }}
          >
            <div className="vx-tile-label">{item.title}</div>
            <div className="vx-tile-sub">Framed. Portal build.</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SecurityMosaic({ consoleId }: { consoleId?: string }) {
  const consoles = WING_CONSOLES.security;
  const active = consoleId ?? consoles[0]?.id;

  return (
    <div>
      <div className="vx-metrics">
        <Metric label="P0 (30d)" value="0" sub="Standing target" />
        <Metric label="P1 (30d)" value="0" sub="Standing target" />
        <Metric label="Open findings" value="0" sub="Cite. Remediate. Document." />
        <Metric label="Dev-side escapes (30d)" value="0" sub="Honesty metric" />
      </div>

      <div className="vx-tiles" style={{ marginBottom: 16 }}>
        {consoles.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`vx-tile${item.id === active ? " on" : ""}`}
            style={{ ["--wing-ink" as string]: tokens.security }}
          >
            <div className="vx-tile-label">{item.title}</div>
            <div className="vx-tile-sub">Framed. Portal build.</div>
          </Link>
        ))}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <p className="lbl" style={{ margin: 0 }}>
            Bulletin
          </p>
          <span className="lbl" style={{ margin: 0 }}>
            Last 48h
          </span>
        </div>
        <div className="vx-toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
          {["P0", "P1", "P2", "P3", "Runtime"].map((pill) => (
            <span key={pill} className="vx-pill" style={{ cursor: "default" }}>
              {pill}
            </span>
          ))}
        </div>
        <p style={{ margin: "22px 0 8px", textAlign: "center", color: "#8E887C", fontSize: 13 }}>
          No findings in the last 48 hours.
        </p>
      </div>
    </div>
  );
}

function SocialMosaic({ consoleId }: { consoleId?: string }) {
  const consoles = WING_CONSOLES.social;
  const active = consoleId ?? consoles[0]?.id;

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr)) auto",
          gap: 10,
          marginBottom: 16,
        }}
        className="vx-social-metrics"
      >
        <Metric label="Tasks completed" value="--" sub="No scrape yet" />
        <Metric label="Posts in queue" value="--" sub="No scrape yet" />
        <Metric label="Engagement" value="--" sub="No scrape yet" />
        <button type="button" className="vx-primary" disabled>
          Export report
        </button>
      </div>

      <p className="lbl" style={{ margin: "0 0 10px" }}>
        Agent desks
      </p>
      <div className="vx-mosaic" style={{ marginBottom: 16 }}>
        {SOCIAL_DESKS.map((desk) => (
          <div key={desk.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "#E1DAD0", fontSize: 14 }}>{desk.title}</span>
              <span className="vx-pill" style={{ cursor: "default", color: tokens.social, borderColor: tokens.social }}>
                {desk.state}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>{desk.note}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 16 }}>
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
            {SOCIAL_ROWS.map((row) => (
              <tr key={row.platform}>
                <td style={{ color: "#E1DAD0" }}>{row.platform}</td>
                <td>--</td>
                <td>--</td>
                <td>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="lbl" style={{ margin: "0 0 10px" }}>
        Consoles
      </p>
      <div className="vx-tiles">
        {consoles.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`vx-tile${item.id === active ? " on" : ""}`}
            style={{ ["--wing-ink" as string]: tokens.social }}
          >
            <div className="vx-tile-label">{item.title}</div>
            <div className="vx-tile-sub">Placeholder. Prompt 2C parked.</div>
          </Link>
        ))}
      </div>
      <style>{`
        @media (max-width: 900px) {
          .vx-social-metrics { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
