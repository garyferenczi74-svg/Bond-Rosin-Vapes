"use client";

import { useEffect, useState } from "react";
import { readPublishedWritesAction } from "@/app/vauxhall/haus-actions";
import type { HouseWrite } from "@/lib/haus/types";
import { tokens } from "@/lib/tokens";

export function HausWritesStrip() {
  const [writes, setWrites] = useState<HouseWrite[]>([]);

  useEffect(() => {
    let cancelled = false;
    readPublishedWritesAction().then((rows) => {
      if (cancelled) return;
      setWrites(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (writes.length === 0) return null;

  return (
    <div className="card" style={{ marginTop: 28, maxWidth: 560 }}>
      <p className="lbl" style={{ margin: 0 }}>
        The house writes
      </p>
      {writes.map((write) => (
        <p
          key={write.id}
          style={{
            margin: "14px 0 0",
            fontSize: 13.5,
            color: "#B0A99A",
            borderBottom: `1px solid ${tokens.deepCharcoal}`,
            paddingBottom: 8,
          }}
        >
          {write.body}
        </p>
      ))}
    </div>
  );
}
