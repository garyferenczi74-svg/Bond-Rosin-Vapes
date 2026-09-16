import { tokens } from "@/lib/tokens";

const GOLD =
  "linear-gradient(160deg,#8F6B25 0%,#C29A45 38%,#E3C270 50%,#C29A45 62%,#8F6B25 100%)";

export function ComplianceBand() {
  return (
    <div
      style={{
        borderTop: `1px solid ${tokens.deepCharcoal}`,
        padding: "36px clamp(20px, 4vw, 56px) 40px",
        textAlign: "center",
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
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: tokens.muted, margin: "0 0 8px" }}>
          For use only by adults 21 years of age and older. Keep out of reach of children and pets.
          In case of accidental ingestion or overconsumption, contact the Poison Center at
          1-800-222-1222 or call 9-1-1. Please consume responsibly.
        </p>
        <p style={{ fontSize: 11.5, lineHeight: 1.85, color: tokens.muted, margin: "0 0 8px" }}>
          Cannabis may cause impairment and may be habit forming.
        </p>
        <p style={{ fontSize: 11, lineHeight: 1.7, color: "#6E685E", margin: 0 }}>
          Licensed by the New York State Office of Cannabis Management. OCM-Proc-25-000329
        </p>
      </div>
    </div>
  );
}
