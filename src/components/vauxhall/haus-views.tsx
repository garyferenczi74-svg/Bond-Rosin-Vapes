"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@/lib/tokens";
import { tokens } from "@/lib/tokens";
import { lintFields, lintHasHardBlock } from "@/lib/haus/lint";
import type { HausStore } from "@/lib/haus/store";
import type { HouseWrite, WriteLink } from "@/lib/haus/types";
import { ConsoleHeader, DesignPreviewBadge } from "./console-chrome";
import { persistHausStore, useHausLedger, useHausStore } from "./use-haus-store";

const OXIDE = tokens.security;
const BONE = tokens.bone;

function queryValue(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function StateChip({ state }: { state: string }) {
  const ink =
    state === "published" || state === "active" || state === "accepted"
      ? tokens.product
      : state === "issued"
        ? BONE
        : state === "draft"
          ? tokens.muted
          : OXIDE;
  return (
    <span className="vx-pill" style={{ cursor: "default", color: ink, borderColor: ink }}>
      {state}
    </span>
  );
}

function LintRail({ fields }: { fields: string[] }) {
  const hits = lintFields(fields);
  if (hits.length === 0) {
    return <div style={{ fontSize: 12, color: tokens.product }}>Lint clean. Publish is open.</div>;
  }
  return (
    <div>
      {hits.map((hit) => (
        <div
          key={`${hit.kind}-${hit.detail}`}
          style={{ fontSize: 12, color: OXIDE, marginBottom: 4 }}
        >
          {hit.kind}: {hit.detail}
          {lintHasHardBlock([hit]) ? " (hard block)" : ""}
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: tokens.muted, marginTop: 6 }}>
        Publish is blocked until this clears.
      </div>
    </div>
  );
}

function ParkedDesk({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <ConsoleHeader title={title} subtitle={note} right={<DesignPreviewBadge />} />
      <div className="card vx-parked-haus">
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Parked
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#B0A99A", lineHeight: 1.6 }}>
          This desk arrives with Phase B.
        </p>
      </div>
    </div>
  );
}

export function HausWing({
  consoleId,
  role,
  onToast,
}: {
  consoleId?: string;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const store = useHausStore();
  useHausLedger(store);
  const active = consoleId ?? "dashboard";
  if (active === "content") return <ContentDesk store={store} onToast={onToast} />;
  if (active === "members") return <MembersDesk store={store} onToast={onToast} />;
  if (active === "settings") return <SettingsDesk store={store} role={role} onToast={onToast} />;
  if (active === "batches") return <ParkedDesk title="Batches" note="The house records the member Library checks." />;
  if (active === "reserve") return <ParkedDesk title="Reserve" note="Numbered run registry." />;
  if (active === "events") return <ParkedDesk title="Events" note="Member evenings." />;
  if (active === "guide") return <ParkedDesk title="Guide" note="The Experience Guide chapters." />;
  return <DashboardDesk store={store} onToast={onToast} />;
}

function DashboardDesk({
  store,
  onToast,
}: {
  store: HausStore;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const dash = store.dashboard();
  const reserve = dash.reserve;

  async function newWrite() {
    const write = store.createHouseWrite();
    await persistHausStore(store);
    onToast("Draft opened.");
    router.push(`/vauxhall/haus/content?write=${write.id}`);
  }

  return (
    <div>
      <ConsoleHeader
        title="Dashboard"
        subtitle="The house counts; it does not read."
        right={<DesignPreviewBadge />}
      />
      <div className="vx-haus-kpis">
        <Link className="card vx-haus-kpi" href="/vauxhall/haus/members">
          <p className="lbl" style={{ margin: 0 }}>
            Active members
          </p>
          <div className="vx-metric-value">{dash.activeMembers}</div>
        </Link>
        <Link className="card vx-haus-kpi" href="/vauxhall/haus/members">
          <p className="lbl" style={{ margin: 0 }}>
            Invitations out
          </p>
          <div className="vx-metric-value">{dash.invitationsOut}</div>
        </Link>
        <div className="card vx-haus-kpi vx-haus-kpi-inert">
          <p className="lbl" style={{ margin: 0 }}>
            Shelves holding
          </p>
          <div className="vx-metric-value">{dash.shelvesHolding}</div>
          <p className="vx-metric-sub">Stub count</p>
        </div>
        <div className="card vx-haus-kpi vx-haus-kpi-inert">
          <p className="lbl" style={{ margin: 0 }}>
            Rituals this month
          </p>
          <div className="vx-metric-value">{dash.ritualsThisMonth}</div>
          <p className="vx-metric-sub">Stub count</p>
        </div>
        <div className="card vx-haus-kpi vx-haus-kpi-inert">
          <p className="lbl" style={{ margin: 0 }}>
            Notes held
          </p>
          <div className="vx-metric-value">{dash.notesHeld}</div>
          <p className="vx-metric-sub">count only</p>
        </div>
        <Link className="card vx-haus-kpi" href="/vauxhall/haus/content">
          <p className="lbl" style={{ margin: 0 }}>
            House Writes live
          </p>
          <div className="vx-metric-value">{dash.houseWritesLive}</div>
        </Link>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", color: BONE, fontSize: 12.5 }}>
          Publishing board
        </div>
        <table className="vx-data">
          <thead>
            <tr>
              <th>Type</th>
              <th>Draft</th>
              <th>Published</th>
              <th>Retired</th>
            </tr>
          </thead>
          <tbody>
            {dash.board.map((row) => (
              <tr key={row.id}>
                <td style={{ color: BONE }}>{row.label}</td>
                {["draft", "published", "retired"].map((state) => {
                  const n =
                    state === "draft" ? row.draft : state === "published" ? row.published : row.retired;
                  const blocked = state === "draft" && row.lintBlocked > 0;
                  return (
                    <td key={state}>
                      <Link
                        href={`${row.href}?state=${state}`}
                        className="mono"
                        style={{ color: blocked ? OXIDE : "#B0A99A" }}
                      >
                        {n}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vx-split" style={{ marginTop: 16 }}>
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 8px" }}>
            Event fill
          </p>
          {dash.events.map((event) => {
            const pct = Math.round((event.confirmed / event.capacity) * 100);
            return (
              <Link key={event.id} href="/vauxhall/haus/events" style={{ display: "block", marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{event.name}</span>
                  <span className="mono" style={{ color: tokens.muted }}>
                    {event.confirmed} of {event.capacity}
                  </span>
                </div>
                <div className="vx-fill-bar">
                  <span style={{ width: `${pct}%`, background: pct >= 90 ? OXIDE : tokens.muted }} />
                </div>
              </Link>
            );
          })}
        </div>
        <Link className="card" href="/vauxhall/haus/reserve" style={{ display: "block", textAlign: "center" }}>
          <p className="lbl" style={{ margin: 0 }}>
            Reserve progress
          </p>
          {reserve ? <ReserveRing claimed={reserve.claimed} size={reserve.size} cultivar={reserve.cultivar} /> : (
            <p style={{ color: tokens.muted }}>No open run</p>
          )}
        </Link>
      </div>

      <div className="vx-split" style={{ marginTop: 16 }}>
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 12px" }}>
            Invitation funnel . 30 days
          </p>
          <div style={{ display: "flex", gap: 18, fontSize: 13 }}>
            <span>
              Issued <span className="mono" style={{ color: BONE }}>{dash.invitationFunnel.issued}</span>
            </span>
            <span>
              Accepted <span className="mono" style={{ color: tokens.product }}>{dash.invitationFunnel.accepted}</span>
            </span>
            <span>
              Expired <span className="mono" style={{ color: OXIDE }}>{dash.invitationFunnel.expired}</span>
            </span>
          </div>
          <p style={{ fontSize: 12, color: tokens.muted, margin: "10px 0 0" }}>
            Conversion {dash.invitationFunnel.conversion} percent
          </p>
          <Link href="/vauxhall/haus/members" className="vx-act" style={{ display: "inline-block", marginTop: 12 }}>
            Open invitations
          </Link>
        </div>
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 12px" }}>
            Quick actions
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="vx-act" onClick={() => void newWrite()}>
              New House Write
            </button>
            <Link href="/vauxhall/haus/batches" className="vx-act" style={{ textAlign: "center" }}>
              New Batch
            </Link>
            <Link href="/vauxhall/haus/events" className="vx-act" style={{ textAlign: "center" }}>
              New Event
            </Link>
            <Link href="/vauxhall/haus/members" className="vx-act" style={{ textAlign: "center" }}>
              Issue invitation
            </Link>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p className="lbl" style={{ margin: "0 0 10px" }}>
          Attention
        </p>
        {dash.attention.length === 0 ? (
          <div style={{ fontSize: 13, color: tokens.product }}>The house is in order.</div>
        ) : (
          dash.attention.map((item) => (
            <Link
              key={`${item.kind}-${item.text}`}
              href={item.href}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid #232323",
              }}
            >
              <span className="vx-pill" style={{ cursor: "default", color: OXIDE, borderColor: OXIDE }}>
                {item.kind}
              </span>
              <span style={{ color: "#B0A99A", fontSize: 12.5 }}>{item.text}</span>
            </Link>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", color: BONE, fontSize: 12.5 }}>
          Activity . admin actions only
        </div>
        {dash.activity.map((row) => (
          <div
            key={`${row.ts}-${row.action}`}
            style={{
              display: "flex",
              gap: 14,
              padding: "9px 16px",
              borderBottom: "1px solid #232323",
              fontSize: 12,
            }}
          >
            <span className="mono" style={{ color: "#5E5A52", minWidth: 130 }}>
              {row.ts}
            </span>
            <span style={{ color: "#B0A99A" }}>{row.action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReserveRing({
  claimed,
  size,
  cultivar,
}: {
  claimed: number;
  size: number;
  cultivar: string;
}) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const frac = size > 0 ? claimed / size : 0;
  return (
    <div>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ display: "block", margin: "12px auto 0" }}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="#2A2C29" strokeWidth="1.5" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={OXIDE}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={(c * (1 - frac)).toFixed(1)}
          transform="rotate(-90 90 90)"
        />
        <text
          x="90"
          y="90"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="Aptos, 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif"
          fontSize="26"
          fill={BONE}
        >
          {claimed} of {size}
        </text>
      </svg>
      <div style={{ fontSize: 12, color: tokens.muted }}>{cultivar}</div>
    </div>
  );
}

function ContentDesk({
  store,
  onToast,
}: {
  store: HausStore;
  onToast: (msg: string) => void;
}) {
  const [filter, setFilter] = useState(() => queryValue("state"));
  const [selected, setSelected] = useState(() => queryValue("write"));

  useEffect(() => {
    const state = queryValue("state");
    const write = queryValue("write");
    if (state) setFilter(state);
    if (write) setSelected(write);
  }, [store.revision]);

  const rows = store.listHouseWrites(filter || undefined);

  async function addWrite() {
    const write = store.createHouseWrite();
    setSelected(write.id);
    setFilter("");
    await persistHausStore(store);
    onToast("Draft opened.");
  }

  return (
    <div>
      <ConsoleHeader
        title="Content"
        subtitle="The House Writes the Salon shows. Publish pushes a line into the member Salon."
        right={
          <>
            <button type="button" className="vx-act" onClick={() => void addWrite()}>
              New
            </button>
            <DesignPreviewBadge />
          </>
        }
      />
      <div className="vx-toolbar">
        {["", "draft", "published", "retired"].map((state) => (
          <button
            key={state || "all"}
            type="button"
            className={`vx-chip${filter === state ? " active" : ""}`}
            onClick={() => setFilter(state)}
          >
            {state || "All"}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="vx-data">
          <thead>
            <tr>
              <th>Title</th>
              <th>Body</th>
              <th>Link</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((write) => {
              const blocked =
                write.state === "draft" && lintFields([write.title, write.body]).length > 0;
              return (
                <tr
                  key={write.id}
                  onClick={() => setSelected(write.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td style={{ color: BONE }}>{write.title || write.id}</td>
                  <td>{write.body}</td>
                  <td className="mono" style={{ color: tokens.muted }}>
                    {write.link}
                  </td>
                  <td>
                    <StateChip state={write.state} />
                    {blocked ? (
                      <span className="vx-pill" style={{ marginLeft: 6, color: OXIDE, borderColor: OXIDE }}>
                        lint
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <WriteEditor store={store} writeId={selected} onToast={onToast} />
      ) : null}
    </div>
  );
}

function WriteEditor({
  store,
  writeId,
  onToast,
}: {
  store: HausStore;
  writeId: string;
  onToast: (msg: string) => void;
}) {
  const write = store.getWrite(writeId);
  if (write == null) return null;

  function patch(next: Partial<Pick<HouseWrite, "title" | "body" | "link" | "from" | "order">>) {
    store.updateHouseWrite(writeId, next);
  }

  async function publish() {
    const result = store.publishHouseWrite(writeId);
    if (result.ok) {
      await persistHausStore(store);
      onToast("Published to the Haus.");
      return;
    }
    onToast(`Blocked: ${result.hits.map((hit) => hit.kind).join(", ")}`);
  }

  async function retire() {
    store.retireHouseWrite(writeId);
    await persistHausStore(store);
    onToast("Retired. It leaves the Salon.");
  }

  return (
    <div className="card" style={{ marginTop: 16, borderColor: "#55503F55" }}>
      <p className="lbl" style={{ margin: "0 0 12px" }}>
        Edit {write.id}
      </p>
      <label>
        <span className="lbl">Title</span>
        <input
          className="field"
          value={write.title}
          onChange={(event) => patch({ title: event.target.value })}
          style={{ marginTop: 6 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 14 }}>
        <span className="lbl">Body . one line, {write.body.length} of 90</span>
        <input
          className="field"
          maxLength={90}
          value={write.body}
          onChange={(event) => patch({ body: event.target.value })}
          style={{ marginTop: 6 }}
        />
      </label>
      <div className="vx-form-grid" style={{ marginTop: 14 }}>
        <label>
          <span className="lbl">Link target</span>
          <select
            className="field"
            value={write.link}
            onChange={(event) => patch({ link: event.target.value as WriteLink })}
            style={{ marginTop: 6 }}
          >
            <option value="">None</option>
            <option value="guide">Guide</option>
            <option value="reserve">Reserve</option>
            <option value="events">Event</option>
          </select>
        </label>
        <label>
          <span className="lbl">From</span>
          <input
            type="date"
            className="field"
            value={write.from}
            onChange={(event) => patch({ from: event.target.value })}
            style={{ marginTop: 6 }}
          />
        </label>
        <label>
          <span className="lbl">Order</span>
          <input
            type="number"
            className="field"
            value={write.order}
            onChange={(event) => patch({ order: Number(event.target.value) })}
            style={{ marginTop: 6 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #232323" }}>
        <LintRail fields={[write.title, write.body]} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {write.state === "published" ? (
          <button type="button" className="vx-act" onClick={() => void retire()}>
            Retire
          </button>
        ) : (
          <button type="button" className="vx-act" onClick={() => void publish()}>
            Publish to the Haus
          </button>
        )}
      </div>
    </div>
  );
}

function MembersDesk({
  store,
  onToast,
}: {
  store: HausStore;
  onToast: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const invites = store.listInvitations();
  const list = store.listHausEmails();
  const windowOpen = store.settings().invitationWindow;

  async function issue() {
    const result = store.issueInvitation(email);
    if (result.ok === false) {
      onToast(result.reason ?? "Choose a Haus email.");
      return;
    }
    setEmail("");
    await persistHausStore(store);
    onToast("Invitation issued.");
  }

  async function reissue(value: string) {
    store.reissueInvitation(value);
    await persistHausStore(store);
    onToast("Reissued.");
  }

  async function revoke(value: string) {
    store.revokeInvitation(value);
    await persistHausStore(store);
    onToast("Revoked. Registration will fail with the neutral line.");
  }

  return (
    <div>
      <ConsoleHeader
        title="Members"
        subtitle="Administration without surveillance."
        right={<DesignPreviewBadge />}
      />
      <div className="card">
        <p className="lbl" style={{ margin: "0 0 12px" }}>
          Invitations
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          >
            <option value="">Choose a Haus email</option>
            {list.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="vx-act"
            disabled={windowOpen === false}
            onClick={() => void issue()}
          >
            Issue
          </button>
        </div>
        {windowOpen === false ? (
          <p style={{ fontSize: 12, color: tokens.muted, margin: "10px 0 0" }}>
            Invitation window is closed.
          </p>
        ) : null}
        <table className="vx-data" style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Email</th>
              <th>State</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={`${invite.email}-${invite.state}-${invite.expires}`}>
                <td className="mono">{invite.email}</td>
                <td>
                  <StateChip state={invite.state} />
                </td>
                <td className="mono">{invite.expires}</td>
                <td>
                  {invite.state === "expired" || invite.state === "revoked" ? (
                    <button type="button" className="vx-act" onClick={() => void reissue(invite.email)}>
                      Reissue
                    </button>
                  ) : null}
                  {invite.state === "issued" ? (
                    <button type="button" className="vx-act" onClick={() => void revoke(invite.email)}>
                      Revoke
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card vx-parked-haus" style={{ marginTop: 16 }}>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Accounts
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#B0A99A", lineHeight: 1.6 }}>
          This desk arrives with Phase B.
        </p>
      </div>
      <div className="card vx-parked-haus" style={{ marginTop: 16 }}>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Aggregates
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#B0A99A", lineHeight: 1.6 }}>
          This desk arrives with Phase B.
        </p>
      </div>
    </div>
  );
}

function SettingsDesk({
  store,
  role,
  onToast,
}: {
  store: HausStore;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const settings = store.settings();
  const [welcome, setWelcome] = useState(settings.welcomeText);

  useEffect(() => {
    setWelcome(store.settings().welcomeText);
  }, [store, store.revision]);

  if (role === "owner") {
    return (
      <div>
        <ConsoleHeader
          title="Settings"
          subtitle="Haus-wide switches, owner only. Every switch writes an audit entry."
          right={<DesignPreviewBadge />}
        />
        <div className="card">
          <label className="vx-haus-toggle">
            <span>Invitation window open</span>
            <input
              type="checkbox"
              checked={settings.invitationWindow}
              onChange={(event) => {
                store.setInvitationWindow(event.target.checked);
                void persistHausStore(store);
                onToast("Saved.");
              }}
            />
          </label>
          <label className="vx-haus-toggle">
            <span>Pause new registration</span>
            <input
              type="checkbox"
              checked={settings.registrationPause}
              onChange={(event) => {
                store.setRegistrationPause(event.target.checked);
                void persistHausStore(store);
                onToast("Saved.");
              }}
            />
          </label>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p className="lbl" style={{ margin: 0 }}>
            Welcome interstitial text
          </p>
          <textarea
            className="field"
            rows={2}
            value={welcome}
            onChange={(event) => setWelcome(event.target.value)}
            style={{ marginTop: 8, resize: "vertical" }}
          />
          <div style={{ marginTop: 10 }}>
            <LintRail fields={[welcome]} />
          </div>
          <button
            type="button"
            className="vx-act"
            style={{ marginTop: 10 }}
            onClick={() => {
              const result = store.setWelcomeText(welcome);
              if (result.ok === false) {
                onToast(`Blocked: ${result.hits.map((hit) => hit.kind).join(", ")}`);
                return;
              }
              void persistHausStore(store);
              onToast("Saved.");
            }}
          >
            Save welcome text
          </button>
        </div>
        <PrivacyWallCard text={settings.privacyWall} />
      </div>
    );
  }

  return (
    <div>
      <ConsoleHeader
        title="Settings"
        subtitle="Haus-wide switches, owner only."
        right={<DesignPreviewBadge />}
      />
      <div className="card vx-parked-haus">
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          Owner only
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#B0A99A", lineHeight: 1.6 }}>
          Settings stay closed for this role. The privacy wall still holds.
        </p>
      </div>
      <PrivacyWallCard text={settings.privacyWall} />
    </div>
  );
}

function PrivacyWallCard({ text }: { text: string }) {
  return (
    <div className="card" style={{ marginTop: 16, borderColor: "#55503F55" }}>
      <p className="lbl" style={{ margin: 0 }}>
        The privacy wall . read only
      </p>
      <p style={{ fontSize: 13, color: "#B0A99A", lineHeight: 1.8, margin: "12px 0 0" }}>{text}</p>
      <p style={{ fontSize: 11.5, color: tokens.muted, margin: "10px 0 0" }}>
        Enforced in the store: no method returns member note, reflection, or session content to any
        admin context.
      </p>
    </div>
  );
}
