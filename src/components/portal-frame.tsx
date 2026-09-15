import Link from "next/link";
import { signOutAction } from "@/app/haus/actions";
import type { AdminRole, WingId } from "@/lib/tokens";
import { wings } from "@/lib/tokens";

export function PortalFrame({
  role,
  active,
  children,
}: {
  role: AdminRole;
  active: WingId;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#1B1D1C", color: "#E1DAD0" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px clamp(16px, 3vw, 32px)",
          borderBottom: "1px solid #2A2A2A",
        }}
      >
        <span
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontWeight: 400,
            fontSize: 16,
            letterSpacing: "0.35em",
            paddingLeft: "0.35em",
          }}
        >
          BOND
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="lbl" style={{ margin: 0 }}>
            {role}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                background: "transparent",
                border: "1px solid #3A3C3B",
                color: "#8E887C",
                borderRadius: 2,
                fontFamily: "inherit",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          minHeight: "calc(100vh - 61px)",
        }}
        className="portal-grid"
      >
        <nav
          style={{
            borderRight: "1px solid #2A2A2A",
            padding: "22px 16px",
            display: "grid",
            alignContent: "start",
            gap: 8,
          }}
        >
          {wings.map((wing) => {
            const on = wing.id === active;
            return (
              <Link
                key={wing.id}
                href={wing.href}
                style={{
                  display: "block",
                  padding: "12px 12px 11px",
                  borderTop: on ? `1px solid ${wing.hairline}` : "1px solid transparent",
                  color: on ? "#E1DAD0" : "#8E887C",
                  fontSize: 13,
                  letterSpacing: "0.04em",
                }}
              >
                {wing.title}
              </Link>
            );
          })}
        </nav>
        <section className="rise" style={{ padding: "clamp(20px, 3vw, 36px)" }}>
          {children}
        </section>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .portal-grid { grid-template-columns: 1fr !important; }
          .portal-grid nav { border-right: none !important; border-bottom: 1px solid #2A2A2A; grid-auto-flow: column; overflow-x: auto; }
        }
      `}</style>
    </div>
  );
}
