import { tokens } from "@/lib/tokens";

const GOLD =
  "linear-gradient(160deg,#8F6B25 0%,#C29A45 38%,#E3C270 50%,#C29A45 62%,#8F6B25 100%)";

const REQUIRED =
  "For use only by persons 21 years of age and older. Keep out of reach of children and pets. If someone accidentally consumes cannabis, contact the Poison Center. Consume responsibly.";

const HEALTH = [
  "Cannabis can be addictive.",
  "Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis.",
  "There may be health risks associated with consumption of this product.",
  "Cannabis is not recommended for use by persons who are pregnant or nursing.",
] as const;

export function ComplianceBand() {
  const warnText = {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--matte-black)",
    margin: "0 0 8px",
  } as const;

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
        <div
          style={{
            position: "relative",
            zIndex: 2,
            background: "var(--bond-warning-yellow)",
            color: "var(--matte-black)",
            border: "1px solid var(--matte-black)",
            padding: "12px 14px",
            textAlign: "left",
          }}
        >
          <p style={warnText}>{REQUIRED}</p>
          {HEALTH.map((line, index) => (
            <p key={line} style={index === HEALTH.length - 1 ? { ...warnText, margin: 0 } : warnText}>
              {line}
            </p>
          ))}
        </div>
        <p
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 12,
            lineHeight: 1.5,
            color: tokens.muted,
            margin: "12px 0 0",
          }}
        >
          Concerned about your cannabis use? Contact the New York State HOPEline by texting HOPENY (467369),
          calling{" "}
          <a href="tel:18778467369" style={{ color: "inherit" }}>
            1-877-8-HOPENY
          </a>
          , or visiting{" "}
          <a href="https://oasas.ny.gov/hopeline" style={{ color: "inherit" }}>
            oasas.ny.gov/hopeline
          </a>
          .
        </p>
        <p style={{ fontSize: 11, lineHeight: 1.7, color: tokens.muted, margin: "12px 0 0" }}>
          Cedargrowth LLC. Licensed by the New York State Office of Cannabis Management.
          OCM-PROC-25-000329
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.7, color: tokens.muted, margin: "16px 0 0" }}>
          21+ Cannabis products. Keep out of reach of children.
        </p>
      </div>
    </footer>
  );
}
