"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminRole } from "@/lib/tokens";
import { tokens } from "@/lib/tokens";
import type { VauxhallStore } from "@/lib/vauxhall/store";
import { isAllocatableStatus } from "@/lib/vauxhall/trace";
import { ORDER_STAGES, RUN_STAGES, type OrderLine, type OrderStage, type Sku } from "@/lib/vauxhall/types";
import { ConsoleHeader, SeedBanner, StalenessStamp } from "./console-chrome";
import { Metric } from "./metric";
import { ProductPortfolio } from "./product-portfolio";
import { useVauxhallStore } from "./use-store";

function skuLabel(sku?: Sku, fallback = "Unknown SKU"): string {
  return sku ? `${sku.number} ${sku.editionName}` : fallback;
}

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 0, marginBottom: 16 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #232323", color: "#E1DAD0", fontSize: 13 }}>
        {title}
      </div>
      <div style={{ overflow: "auto" }}>{children}</div>
    </div>
  );
}

export function ProductWing({
  consoleId,
  role,
  onToast,
}: {
  consoleId?: string;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const store = useVauxhallStore();
  const active = consoleId ?? "sku-portfolio";
  if (active === "sku-portfolio") return <ProductPortfolio />;
  if (active === "dashboard") return <ProductDashboard store={store} />;
  if (active === "board-metrics") return <BoardMetrics store={store} />;
  if (active === "unit-economics") return <UnitEconomics store={store} role={role} onToast={onToast} />;
  if (active === "alerts-and-risks") return <AlertsRisks store={store} />;
  if (active === "inventory") return <InventoryView store={store} onToast={onToast} />;
  if (active === "production") return <ProductionView store={store} onToast={onToast} />;
  if (active === "orders") return <OrdersView store={store} onToast={onToast} />;
  if (active === "accounts") return <AccountsView store={store} onToast={onToast} />;
  if (active === "trace") return <TraceView store={store} role={role} onToast={onToast} />;
  return <ProductDashboard store={store} />;
}

function ProductDashboard({ store }: { store: VauxhallStore }) {
  const snap = store.dashboardSnapshot();
  const skus = store.listSkus();
  const orders = store.listOrders();
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Dashboard"
        subtitle="Today at a glance. Open orders, stock, process, and the book."
        right={
          <Link href="/vauxhall/product/trace" className="vx-chip">
            {snap.syncStale ? "Sync stale" : "Sync health"} . {snap.stamp}
          </Link>
        }
      />
      <div className="vx-metrics">
        <Metric label="Open orders" value={String(snap.openOrders)} sub="Not delivered or paid" />
        <Metric label="In process" value={String(snap.unitsInProcess)} sub="Mock production yield" />
        <Metric label="Week shipments" value={String(snap.weekShipments)} sub="Shipped plus delivered" />
        <Metric
          label="Sales MTD"
          value={`${snap.mtdUnits} / ${snap.planUnits}`}
          sub="Mock units against plan"
        />
      </div>
      <div className="vx-split">
        <TableCard title="Units on hand by SKU">
          <table className="vx-data">
            <thead>
              <tr>
                <th>SKU</th>
                <th>On hand</th>
                <th>Reserved</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {snap.unitsOnHand.map((row) => (
                <tr key={row.skuId}>
                  <td style={{ color: "#E1DAD0" }}>{skuLabel(store.skuById(row.skuId), row.skuId)}</td>
                  <td>{row.onHand}</td>
                  <td>{row.reserved}</td>
                  <td>{row.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
        <TableCard title="Top accounts by velocity">
          <table className="vx-data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Velocity</th>
              </tr>
            </thead>
            <tbody>
              {snap.topAccounts.map((account) => (
                <tr key={account.id}>
                  <td style={{ color: "#E1DAD0" }}>{account.name}</td>
                  <td>{account.velocity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>
      <p style={{ margin: "0 0 12px" }}>
        <StalenessStamp stamp={snap.stamp} stale={snap.syncStale} />
      </p>
      <TableCard title="Open order stages">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Order</th>
              <th>Account</th>
              <th>Stage</th>
              <th>Promised</th>
              <th>Lines</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ color: "#E1DAD0" }}>{order.id}</td>
                <td>{store.accountById(order.accountId)?.name ?? order.accountId}</td>
                <td>{order.stage}</td>
                <td>{order.promisedOn}</td>
                <td>
                  {order.lines
                    .map((line) => `${skuLabel(skus.find((sku) => sku.id === line.skuId), line.skuId)} ${line.qty}`)
                    .join(" . ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function BoardMetrics({ store }: { store: VauxhallStore }) {
  const skus = store.listSkus();
  const economics = store.listEconomics();
  const collection = store.collectionFrame();
  const [board, setBoard] = useState(false);
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Board Metrics"
        subtitle={`${collection.name}. Mock CedarGrowth drop-in. Not investor figures.`}
        right={
          <button type="button" className="vx-act" onClick={() => setBoard((on) => (on ? false : true))}>
            {board ? "Full view" : "Board view"}
          </button>
        }
      />
      <div className="vx-metrics vx-metrics-3">
        <Metric
          label="Sell-in"
          value={String(economics.reduce((sum, row) => sum + row.mockSellIn, 0))}
          sub="Mock units, year one health"
        />
        <Metric
          label="Reorder"
          value={`${Math.round(
            economics.reduce((sum, row) => sum + row.mockReorderPct, 0) / Math.max(economics.length, 1),
          )}%`}
          sub="Average mock reorder rate"
        />
        <Metric
          label="Reserve run"
          value={String(economics.find((row) => row.skuId === "no-3")?.mockSellIn ?? 0)}
          sub="Peak mock sell-in"
        />
      </div>
      <TableCard title="Revenue by SKU, mock units">
        <table className="vx-data">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Moment</th>
              <th>Sell-in</th>
              <th>Reorder</th>
              <th>MTD</th>
              <th>Plan</th>
              <th>Mock wholesale</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => {
              const row = economics.find((item) => item.skuId === sku.id);
              return (
                <tr key={sku.id}>
                  <td style={{ color: "#E1DAD0" }}>{skuLabel(sku)}</td>
                  <td>{sku.moment}</td>
                  <td>{row?.mockSellIn ?? 0}</td>
                  <td>{row?.mockReorderPct ?? 0}%</td>
                  <td>{row?.mockMtdUnits ?? 0}</td>
                  <td>{row?.mockPlanUnits ?? 0}</td>
                  <td>{row?.mockWholesale ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
      {board ? null : (
        <TableCard title="By account and region">
          <table className="vx-data">
            <thead>
              <tr>
                <th>Account</th>
                <th>Region</th>
                <th>Velocity</th>
                <th>License</th>
              </tr>
            </thead>
            <tbody>
              {store.listAccounts().map((account) => (
                <tr key={account.id}>
                  <td style={{ color: "#E1DAD0" }}>{account.name}</td>
                  <td>{account.region}</td>
                  <td>{account.velocity}</td>
                  <td>
                    {account.license} . {account.licenseMark}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}
    </div>
  );
}

function UnitEconomics({
  store,
  role,
  onToast,
}: {
  store: VauxhallStore;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const skus = store.listSkus();
  const economics = store.listEconomics();
  const owner = role === "owner";
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Unit Economics"
        subtitle="Gross margin per unit. Mock cost inputs. Not a live price list."
      />
      <TableCard title="Mock unit sheet">
        <table className="vx-data">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Mock cost</th>
              <th>Mock wholesale</th>
              <th>Mock margin</th>
              <th>Owner cost</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((sku) => {
              const row = economics.find((item) => item.skuId === sku.id);
              const cost = row?.mockCost ?? 0;
              const wholesale = row?.mockWholesale ?? 0;
              return (
                <tr key={sku.id}>
                  <td style={{ color: "#E1DAD0" }}>{skuLabel(sku)}</td>
                  <td>{cost}</td>
                  <td>{wholesale}</td>
                  <td>{wholesale - cost}</td>
                  <td>
                    {owner ? (
                      <input
                        className="field"
                        type="number"
                        min={0}
                        defaultValue={cost}
                        aria-label={`Mock cost for ${sku.editionName}`}
                        style={{ padding: "8px 10px", fontSize: 13, maxWidth: 120 }}
                        onBlur={(event) => {
                          const next = Number(event.target.value);
                          store.setSkuCost(sku.id, next);
                          onToast("Mock cost updated.");
                        }}
                      />
                    ) : (
                      <span>Owner only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function AlertsRisks({ store }: { store: VauxhallStore }) {
  const alerts = store.listAlerts();
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Alerts and Risks"
        subtitle="Low stock, aging lots, late runs, license clocks, tags, and discrepancies."
      />
      <div className="vx-metrics vx-metrics-3">
        <Metric label="Open alerts" value={String(alerts.length)} sub="Derived from mock seed" />
        <Metric
          label="Action"
          value={String(alerts.filter((item) => item.severity === "action").length)}
          sub="Needs owner eyes"
        />
        <Metric
          label="Watch"
          value={String(alerts.filter((item) => item.severity === "watch").length)}
          sub="Tracked only"
        />
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {alerts.map((alert) => (
          <article key={alert.id} className="card vx-ink-card" style={{ ["--wing-ink" as string]: tokens.product }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#E1DAD0", fontSize: 14 }}>{alert.title}</span>
              <span className="vx-pill" style={{ cursor: "default" }}>
                {alert.kind}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#8E887C" }}>{alert.detail}</p>
            <p style={{ margin: "10px 0 0" }}>
              <Link href={alert.href} className="vx-act" style={{ display: "inline-block" }}>
                Open source
              </Link>
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InventoryView({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const skus = store.listSkus();
  const lots = store.listLots();
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    await store.refreshFromMetrc();
    setBusy(false);
    onToast("Mock Metrc refresh complete.");
  }
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Inventory"
        subtitle="On-hand by SKU and mock lot. Reserved cannot be double sold."
        right={
          <>
            <StalenessStamp stamp={store.stamp()} stale={store.traceSnap.sync.stale} />
            <button type="button" className="vx-act" onClick={() => void refresh()} disabled={busy}>
              {busy ? "Refreshing" : "Refresh mock Metrc"}
            </button>
          </>
        }
      />
      <div className="vx-metrics vx-metrics-3">
        {skus.map((sku) => {
          const units = store.unitsForSku(sku.id);
          return (
            <Metric
              key={sku.id}
              label={skuLabel(sku)}
              value={String(units.available)}
              sub={`${units.onHand} on hand . ${units.reserved} reserved`}
            />
          );
        })}
      </div>
      <TableCard title="Lots">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Lot</th>
              <th>SKU</th>
              <th>Metrc UID</th>
              <th>Test</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Location</th>
              <th>Packaged</th>
              <th>COA</th>
            </tr>
          </thead>
          <tbody>
            {skus.flatMap((sku) => {
              const skuLots = lots.filter((lot) => lot.skuId === sku.id);
              if (skuLots.length === 0) {
                return [
                  <tr key={sku.id}>
                    <td style={{ color: "#E1DAD0" }}>None</td>
                    <td>{skuLabel(sku)}</td>
                    <td>None</td>
                    <td>None</td>
                    <td>0</td>
                    <td>0</td>
                    <td>0</td>
                    <td>Unassigned</td>
                    <td>None</td>
                    <td>No COA on file. Mock seed.</td>
                  </tr>,
                ];
              }
              return skuLots.map((lot) => (
                <tr key={lot.id}>
                  <td style={{ color: "#E1DAD0" }}>{lot.batchLabel}</td>
                  <td>{skuLabel(sku)}</td>
                  <td>{lot.metrcUid}</td>
                  <td>{lot.testStatus}</td>
                  <td>{lot.onHand}</td>
                  <td>{lot.reserved}</td>
                  <td>{lot.onHand - lot.reserved}</td>
                  <td>{lot.location}</td>
                  <td>{lot.packagedOn}</td>
                  <td>{lot.coaNote}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function ProductionView({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const runs = store.listRuns();
  async function complete(id: string) {
    const result = await store.completeRun(id);
    onToast(result.ok ? `Lot ${result.lotId} minted. TestingRequired until mock lab flip.` : result.reason);
  }
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Production"
        subtitle="Stock in process. Completing a run mints a mock Metrc UID."
        right={<StalenessStamp stamp={store.stamp()} stale={store.traceSnap.sync.stale} />}
      />
      <div className="vx-toolbar">
        {RUN_STAGES.map((stage) => (
          <span key={stage} className="vx-pill" style={{ cursor: "default" }}>
            {stage} {runs.filter((run) => run.stage === stage).length}
          </span>
        ))}
      </div>
      <TableCard title="Pressing and filling">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Run</th>
              <th>SKU</th>
              <th>Stage</th>
              <th>Yield</th>
              <th>Completion</th>
              <th>State</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td style={{ color: "#E1DAD0" }}>{run.id}</td>
                <td>{skuLabel(store.skuById(run.skuId), run.skuId)}</td>
                <td>{run.stage}</td>
                <td>{run.expectedYield}</td>
                <td>{run.expectedCompletion}</td>
                <td>{run.late ? "Late" : "On clock"}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="vx-act"
                      onClick={() => {
                        const result = store.advanceRun(run.id);
                        onToast(result.ok ? `Advanced to ${result.stage}.` : result.reason);
                      }}
                    >
                      Advance
                    </button>
                    <button type="button" className="vx-act" onClick={() => void complete(run.id)}>
                      Complete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function OrdersView({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const skus = store.listSkus();
  const accounts = store.listAccounts();
  const orders = store.listOrders();
  const firstSku = skus[0];
  const firstAccount = accounts.find((account) => store.canOrderAgainst(account.id)) ?? accounts[0];
  const firstLots = store.listLots().filter((lot) => lot.skuId === firstSku?.id);
  const [accountId, setAccountId] = useState(firstAccount?.id ?? "");
  const [skuId, setSkuId] = useState(firstSku?.id ?? "");
  const [lotId, setLotId] = useState(firstLots.find((lot) => isAllocatableStatus(lot.testStatus))?.id ?? firstLots[0]?.id ?? "");
  const [format, setFormat] = useState(firstSku?.formats[0] ?? "1g");
  const [qty, setQty] = useState(4);
  const [promisedOn, setPromisedOn] = useState("2026-09-24");
  const [openId, setOpenId] = useState<string | null>(orders[0]?.id ?? null);
  const [manifestDraft, setManifestDraft] = useState("");
  const formats = useMemo(() => store.skuById(skuId)?.formats ?? ["1g"], [store, skuId]);
  const skuLots = store.listLots().filter((lot) => lot.skuId === skuId);
  const calendar = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      map.set(order.promisedOn, (map.get(order.promisedOn) ?? 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  function submit() {
    const lot = store.listLots().find((item) => item.id === lotId);
    const line: OrderLine = {
      skuId,
      format,
      qty,
      batchLabel: lot?.batchLabel ?? "MOCK-LOT-DRAFT",
      lotId,
      metrcUid: lot?.metrcUid ?? "",
    };
    const result = store.createOrder({ accountId, lines: [line], promisedOn });
    onToast(result.ok ? `Draft ${result.id} filed.` : result.reason);
  }

  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Orders"
        subtitle="Lifecycle from draft to paid. Test, facility, and manifest gates hold."
        right={<StalenessStamp stamp={store.stamp()} stale={store.traceSnap.sync.stale} />}
      />
      <div className="vx-lanes" aria-label="Order stages">
        {ORDER_STAGES.map((stage: OrderStage) => (
          <section key={stage} className="vx-lane">
            <p className="vx-lane-title">
              {stage} {orders.filter((order) => order.stage === stage).length}
            </p>
            {orders
              .filter((order) => order.stage === stage)
              .map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className="vx-lane-card"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent" }}
                  onClick={() => setOpenId(order.id)}
                >
                  <div style={{ color: "#E1DAD0" }}>{order.id}</div>
                  <div>{store.accountById(order.accountId)?.name ?? order.accountId}</div>
                </button>
              ))}
          </section>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="lbl" style={{ margin: "0 0 12px" }}>
          New mock order
        </p>
        <div className="vx-form-grid">
          <label>
            <span className="lbl">Account</span>
            <select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} . {store.licenseState(account)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">SKU</span>
            <select
              className="field"
              value={skuId}
              onChange={(event) => {
                const next = event.target.value;
                setSkuId(next);
                setFormat(store.skuById(next)?.formats[0] ?? "1g");
                const nextLots = store.listLots().filter((lot) => lot.skuId === next);
                setLotId(nextLots.find((lot) => isAllocatableStatus(lot.testStatus))?.id ?? nextLots[0]?.id ?? "");
              }}
            >
              {skus.map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {skuLabel(sku)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Lot</span>
            <select className="field" value={lotId} onChange={(event) => setLotId(event.target.value)}>
              {skuLots.map((lot) => (
                <option key={lot.id} value={lot.id} disabled={isAllocatableStatus(lot.testStatus) ? false : true}>
                  {lot.batchLabel} . {lot.testStatus} . {lot.onHand - lot.reserved} free
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Format</span>
            <select className="field" value={format} onChange={(event) => setFormat(event.target.value)}>
              {formats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="lbl">Qty</span>
            <input
              className="field"
              type="number"
              min={1}
              value={qty}
              onChange={(event) => setQty(Number(event.target.value))}
            />
          </label>
          <label>
            <span className="lbl">Promised</span>
            <input className="field" type="date" value={promisedOn} onChange={(event) => setPromisedOn(event.target.value)} />
          </label>
        </div>
        <button type="button" className="vx-act" style={{ marginTop: 14 }} onClick={submit}>
          File draft
        </button>
      </div>
      <TableCard title="Promised calendar">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {calendar.map(([date, count]) => (
              <tr key={date}>
                <td style={{ color: "#E1DAD0" }}>{date}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Order book">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Order</th>
              <th>Account</th>
              <th>Stage</th>
              <th>Promised</th>
              <th>Manifest</th>
              <th>Late</th>
              <th>Source</th>
              <th>Notes</th>
              <th>Documents</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <button type="button" className="vx-act" onClick={() => setOpenId(order.id)}>
                    {order.id}
                  </button>
                </td>
                <td>{store.accountById(order.accountId)?.name ?? order.accountId}</td>
                <td>{order.stage}</td>
                <td>{order.promisedOn}</td>
                <td>{order.manifestNumber || "None"}</td>
                <td>{order.late ? "Late" : "On clock"}</td>
                <td>{order.source === "partner" ? "partner" : "ops"}</td>
                <td>{order.notes || "None"}</td>
                <td>{order.documents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      {orders
        .filter((order) => order.id === openId)
        .map((order) => (
          <div key={order.id} className="card" style={{ marginBottom: 16 }}>
            <p className="lbl" style={{ margin: "0 0 12px" }}>
              Order detail {order.id}
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#8E887C" }}>
              {store.accountById(order.accountId)?.name ?? order.accountId} . promised {order.promisedOn}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#8E887C" }}>
              Manifest {order.manifestNumber || "none"} . {order.documents}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#8E887C" }}>
              Source {order.source === "partner" ? "partner" : "ops"}
              {order.notes ? ` . Notes ${order.notes}` : ""}
            </p>
            <table className="vx-data" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Lot</th>
                  <th>UID</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, index) => (
                  <tr key={`${order.id}-${index}`}>
                    <td style={{ color: "#E1DAD0" }}>{skuLabel(store.skuById(line.skuId), line.skuId)}</td>
                    <td>{line.batchLabel}</td>
                    <td>{line.metrcUid || "None"}</td>
                    <td>{line.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="vx-form-grid" style={{ marginBottom: 12 }}>
              <label>
                <span className="lbl">Manifest number</span>
                <input
                  className="field"
                  value={manifestDraft}
                  placeholder="MOCK-MANIFEST-"
                  onChange={(event) => setManifestDraft(event.target.value)}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="vx-act"
                onClick={() => {
                  const result = store.setManifestNumber(order.id, manifestDraft);
                  onToast(result.ok ? "Manifest recorded." : result.reason);
                }}
              >
                Save manifest
              </button>
              <button
                type="button"
                className="vx-act"
                onClick={() => {
                  void store.attachManifest(order.id).then((result) => {
                    onToast(result.ok ? "Mock transfer draft attached." : result.reason);
                  });
                }}
              >
                Draft mock transfer
              </button>
              <button
                type="button"
                className="vx-act"
                onClick={() => {
                  const result = store.advanceOrder(order.id);
                  onToast(result.ok ? `Moved to ${result.stage}.` : result.reason);
                }}
              >
                Advance stage
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

function AccountsView({
  store,
  onToast,
}: {
  store: VauxhallStore;
  onToast: (msg: string) => void;
}) {
  const accounts = store.listAccounts();
  const [name, setName] = useState("");
  const [license, setLicense] = useState("MOCK-LIC-PROTO-");
  const [expiresOn, setExpiresOn] = useState("2027-01-01");
  const [contact, setContact] = useState("");
  const [terms, setTerms] = useState("Net 15 mock");
  const [region, setRegion] = useState("North");
  const [verification, setVerification] = useState("");

  function submit() {
    const result = store.createAccount({ name, license, expiresOn, contact, terms, region });
    onToast(result.ok ? "Mock account added." : result.reason);
    if (result.ok) {
      setVerification(result.verification);
      setName("");
      setContact("");
    }
  }

  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Accounts"
        subtitle="Wholesale book. Mock licenses only. Expired licenses cannot order."
        right={<StalenessStamp stamp={store.stamp()} stale={store.traceSnap.sync.stale} />}
      />
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="lbl" style={{ margin: "0 0 12px" }}>
          New account intake
        </p>
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8E887C" }}>
          License verification is required. Use a mock or prototype label. Do not enter a real license number.
        </p>
        <div className="vx-form-grid">
          <label>
            <span className="lbl">Name</span>
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span className="lbl">Mock license</span>
            <input className="field" value={license} onChange={(event) => setLicense(event.target.value)} />
          </label>
          <label>
            <span className="lbl">Expiry</span>
            <input className="field" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
          </label>
          <label>
            <span className="lbl">Contact</span>
            <input className="field" value={contact} onChange={(event) => setContact(event.target.value)} />
          </label>
          <label>
            <span className="lbl">Terms</span>
            <input className="field" value={terms} onChange={(event) => setTerms(event.target.value)} />
          </label>
          <label>
            <span className="lbl">Region</span>
            <input className="field" value={region} onChange={(event) => setRegion(event.target.value)} />
          </label>
        </div>
        <button type="button" className="vx-act" style={{ marginTop: 14 }} onClick={submit}>
          Add mock account
        </button>
        {verification ? (
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#E1DAD0" }}>{verification}</p>
        ) : null}
      </div>
      <TableCard title="Book">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Account</th>
              <th>License</th>
              <th>State</th>
              <th>Metrc facility</th>
              <th>Expiry</th>
              <th>Terms</th>
              <th>Velocity</th>
              <th>Orders</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const facility = store.facilityForAccount(account);
              return (
                <tr key={account.id}>
                  <td style={{ color: "#E1DAD0" }}>{account.name}</td>
                  <td>
                    {account.license} . {account.licenseMark}
                  </td>
                  <td>{store.licenseState(account)}</td>
                  <td>{facility ? (facility.active && facility.licensed ? "active" : "inactive") : "unmatched"}</td>
                  <td>{account.expiresOn}</td>
                  <td>{account.terms}</td>
                  <td>{account.velocity}</td>
                  <td>{store.listOrders().filter((order) => order.accountId === account.id).length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function TraceView({
  store,
  role,
  onToast,
}: {
  store: VauxhallStore;
  role: AdminRole;
  onToast: (msg: string) => void;
}) {
  const snap = store.traceSnap;
  const rows = store.listDiscrepancies();
  const investigations = store.listInvestigations();
  const owner = role === "owner";
  return (
    <div>
      <SeedBanner ink={tokens.product} />
      <ConsoleHeader
        title="Trace"
        subtitle="Mock Metrc room. Packages, transfers, tags, and the discrepancy console."
        right={<StalenessStamp stamp={store.stamp()} stale={snap.sync.stale} />}
      />
      <div className="vx-metrics">
        <Metric label="As of" value={snap.sync.asOf} sub={snap.sync.stale ? "Stale mock pull" : "Last mock pull"} />
        <Metric label="Next pull" value={snap.sync.nextScheduled} sub="Fifteen minute cadence" />
        <Metric label="Package tags" value={String(snap.tags.packageTags)} sub={`Threshold ${snap.tags.packageTagThreshold}`} />
        <Metric label="Retail QR" value={String(snap.tags.retailQrIds)} sub={`Threshold ${snap.tags.retailQrThreshold}`} />
      </div>
      <TableCard title="Sync history">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Object</th>
              <th>Last pull</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(snap.sync.lastPull).map(([key, value]) => (
              <tr key={key}>
                <td style={{ color: "#E1DAD0" }}>{key}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Tag inventory">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Kind</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {snap.tags.packageUids.map((uid) => (
              <tr key={uid}>
                <td>Package UID</td>
                <td style={{ color: "#E1DAD0" }}>{uid}</td>
              </tr>
            ))}
            {snap.tags.retailIds.map((id) => (
              <tr key={id}>
                <td>Retail QR</td>
                <td style={{ color: "#E1DAD0" }}>{id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Discrepancy console">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Lot</th>
              <th>UID</th>
              <th>ERP</th>
              <th>Metrc</th>
              <th>Variance</th>
              <th>Investigation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lotId} className="vx-var-hot">
                <td style={{ color: "#E1DAD0" }}>{row.batchLabel}</td>
                <td>{row.uid}</td>
                <td>{row.erpQty}</td>
                <td>{row.metrcQty}</td>
                <td>{row.variancePct.toFixed(1)}%</td>
                <td>
                  {row.investigationId ? (
                    row.investigationId
                  ) : (
                    <button
                      type="button"
                      className="vx-act"
                      onClick={() => {
                        const result = store.openInvestigation(row.lotId);
                        onToast(result.ok ? `Felix finding ${result.findingId} opened.` : result.reason);
                      }}
                    >
                      Open investigation
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Investigations">
        <table className="vx-data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Lot</th>
              <th>Finding</th>
              <th>State</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {investigations.map((item) => (
              <tr key={item.id}>
                <td style={{ color: "#E1DAD0" }}>{item.id}</td>
                <td>{item.batchLabel}</td>
                <td>{item.findingId}</td>
                <td>{item.state}</td>
                <td>
                  {item.state === "open" ? (
                    <button type="button" className="vx-act" onClick={() => store.resolveInvestigation(item.id)}>
                      Resolve
                    </button>
                  ) : (
                    "Closed"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Raw mock packages">
        <table className="vx-data">
          <thead>
            <tr>
              <th>UID</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Test</th>
              <th>Lab</th>
            </tr>
          </thead>
          <tbody>
            {snap.packages.map((pack) => (
              <tr key={pack.uid}>
                <td style={{ color: "#E1DAD0" }}>{pack.uid}</td>
                <td>{pack.itemName}</td>
                <td>{pack.quantity}</td>
                <td>{pack.testStatus}</td>
                <td>{pack.labNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      <TableCard title="Raw mock transfers">
        <table className="vx-data">
          <thead>
            <tr>
              <th>Manifest</th>
              <th>Order</th>
              <th>To</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {snap.transfers.map((item) => (
              <tr key={item.id}>
                <td style={{ color: "#E1DAD0" }}>{item.manifestNumber}</td>
                <td>{item.orderId}</td>
                <td>{item.toFacilityId}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
      {owner ? (
        <div className="card">
          <p className="lbl" style={{ margin: "0 0 12px" }}>
            Demo controls
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#8E887C" }}>
            Owner only. Seeds mock failure states. Never calls production Metrc.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="vx-act"
              onClick={() => {
                const result = store.demoSeedDiscrepancy();
                onToast(result.ok ? "Mock discrepancy seeded." : result.reason);
              }}
            >
              Seed discrepancy
            </button>
            <button
              type="button"
              className="vx-act"
              onClick={() => {
                store.demoSeedStale();
                onToast("Mock stale sync seeded.");
              }}
            >
              Seed stale sync
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
