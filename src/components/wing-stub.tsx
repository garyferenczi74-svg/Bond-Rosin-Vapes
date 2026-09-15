import type { WingId } from "@/lib/tokens";
import { wings } from "@/lib/tokens";

export function WingStub({ id }: { id: WingId }) {
  const wing = wings.find((item) => item.id === id);
  if (!wing) return null;

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
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="lbl" style={{ margin: "0 0 12px" }}>
          Phase 1 stub
        </p>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "#E1DAD0" }}>{wing.summary}</p>
      </div>
    </div>
  );
}
