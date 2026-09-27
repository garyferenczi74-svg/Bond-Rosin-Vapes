"use client";

import { usePathname } from "next/navigation";
import { BondWarn } from "@/components/bond-warn";
import { warningRouteForPath } from "@/lib/bond-warnings";
import { tokens } from "@/lib/tokens";

const GOLD =
  "linear-gradient(160deg,#8F6B25 0%,#C29A45 38%,#E3C270 50%,#C29A45 62%,#8F6B25 100%)";

export function ComplianceBand() {
  const route = warningRouteForPath(usePathname() || "/");

  return (
    <footer
      style={{
        position: "relative",
        zIndex: 2,
        borderTop: `1px solid ${tokens.deepCharcoal}`,
        padding: "36px clamp(20px, 4vw, 56px) 40px",
        textAlign: "center",
        background: tokens.matteBlack,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            background: GOLD,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            display: "inline-block",
            margin: "0 0 12px",
          }}
        >
          Health and Safety
        </div>
        <BondWarn route={route} />
        <p style={{ fontSize: 12, lineHeight: 1.7, color: tokens.muted, margin: "16px 0 0" }}>
          21+ Cannabis products. Keep out of reach of children.
        </p>
      </div>
    </footer>
  );
}
