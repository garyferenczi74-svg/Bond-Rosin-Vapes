"use client";

import type { Sku, SkuLifecycle, SkuMetrics } from "@/lib/vauxhall/types";
import { Metric } from "./metric";
import { useVauxhallStore } from "./use-store";

function lifecycleLabel(metrics: SkuMetrics): string {
  return (Object.entries(metrics.lifecycle) as [SkuLifecycle, number][])
    .filter(([, count]) => count > 0)
    .map(([state, count]) => `${count} ${state}`)
    .join(", ");
}

function formatList(formats: string[]): string {
  return formats.join(", ");
}

function SkuCard({ sku }: { sku: Sku }) {
  return (
    <article className="vx-sku-card" style={{ ["--sku-ink" as string]: sku.hex }}>
      <div className="vx-sku-head">
        <p className="lbl" style={{ margin: 0 }}>
          {sku.number}
        </p>
        <span className="vx-pill" style={{ cursor: "default" }}>
          {sku.lifecycle}
        </span>
      </div>
      <h2 className="vx-sku-name">{sku.editionName}</h2>
      <p className="lbl" style={{ margin: "8px 0 0" }}>
        {sku.moment}
      </p>
      <p className="vx-sku-triad">{sku.triad}</p>
      <p className="vx-sku-line">{sku.bondLine}</p>
      <p className="vx-sku-formats">{formatList(sku.formats)}</p>
      <p className="vx-sku-batch">{sku.batchNote}</p>
    </article>
  );
}

export function ProductPortfolio() {
  const store = useVauxhallStore();
  const skus = store.listSkus();
  const metrics = store.skuMetrics();
  const collection = store.collectionFrame();
  const formatLabels = formatList([...new Set(skus.flatMap((sku) => sku.formats))]);

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          SKU Portfolio
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>
          {collection.name}. {collection.line}
        </p>
      </header>

      <div className="vx-metrics vx-metrics-3">
        <Metric label="Active SKUs" value={String(metrics.active)} sub="Standing catalog" />
        <Metric label="Formats" value={String(metrics.formats)} sub={formatLabels || "None listed"} />
        <Metric label="Lifecycle" value={lifecycleLabel(metrics) || "None"} sub="Launch seed" />
      </div>

      <div className="vx-sku-grid" aria-label="Standing SKUs">
        {skus.map((sku) => (
          <SkuCard key={sku.id} sku={sku} />
        ))}
      </div>

      <p className="vx-sku-close">{collection.close}</p>
    </div>
  );
}
