import Link from "next/link";
import type { WingId } from "@/lib/tokens";
import { wings } from "@/lib/tokens";
import { WING_CONSOLES } from "@/lib/vauxhall/routes";

export function WingStub({
  id,
  consoleId,
}: {
  id: Exclude<WingId, "command">;
  consoleId?: string;
}) {
  const wing = wings.find((item) => item.id === id);
  if (!wing) return null;
  const consoles = WING_CONSOLES[id];
  const active = consoleId ?? consoles[0]?.id;

  return (
    <div>
      <div style={{ height: 1, background: wing.hairline, width: 72, margin: "0 0 22px" }} />
      <h1
        className="didot"
        style={{
          fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
          fontWeight: 400,
          fontSize: "clamp(28px, 4vw, 40px)",
          letterSpacing: "0.02em",
          margin: "0 0 18px",
        }}
      >
        {wing.title}
      </h1>
      <div className="card" style={{ maxWidth: 720 }}>
        <p className="lbl" style={{ margin: "0 0 12px" }}>
          Wing frame
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.7, color: "#E1DAD0" }}>
          This wing is framed. Consoles arrive with the portal build.
        </p>
        <p className="lbl" style={{ margin: "0 0 10px" }}>
          Consoles
        </p>
        <div style={{ display: "grid", gap: 4 }}>
          {consoles.map((item) => {
            const on = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                style={{
                  display: "block",
                  padding: "10px 12px",
                  borderTop: on ? `1px solid ${wing.hairline}` : "1px solid transparent",
                  color: on ? "#E1DAD0" : "#8E887C",
                  fontSize: 13,
                  letterSpacing: "0.04em",
                }}
              >
                {item.title}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
