import { signOutAction } from "@/app/haus/actions";
import { ComplianceBand } from "@/components/compliance-band";
import { tokens } from "@/lib/tokens";

export function HausFrame({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: tokens.matteBlack,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px clamp(20px, 4vw, 56px)",
          borderBottom: `1px solid ${tokens.deepCharcoal}`,
        }}
      >
        <a
          href="/Home.dc.html"
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 19,
            letterSpacing: "0.35em",
            paddingLeft: "0.35em",
          }}
        >
          BOND
        </a>
        <form action={signOutAction}>
          <button
            className="btn"
            type="submit"
            style={{ width: "auto", padding: "8px 14px" }}
          >
            Sign Out
          </button>
        </form>
      </header>
      <main
        className="rise"
        style={{
          flex: 1,
          padding: "48px clamp(20px, 4vw, 56px) 32px",
        }}
      >
        <h1
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontWeight: 400,
            fontSize: "clamp(32px, 5vw, 48px)",
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {children}
      </main>
      <ComplianceBand />
    </div>
  );
}
