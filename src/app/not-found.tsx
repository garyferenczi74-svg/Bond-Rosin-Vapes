export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0D0F0E",
        textAlign: "center",
        padding: "40px 24px",
      }}
    >
      <div>
        <p
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: "0.4em",
            paddingLeft: "0.4em",
            color: "#E1DAD0",
            margin: "0 0 28px",
          }}
        >
          BOND
        </p>
        <p style={{ fontSize: 14, letterSpacing: "0.04em", color: "#8E887C", margin: "0 0 28px" }}>
          This page is not available.
        </p>
        <a
          href="/Home.dc.html"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#8E887C",
            borderBottom: "1px solid #3A3C3B",
            paddingBottom: 3,
          }}
        >
          Return home
        </a>
      </div>
    </main>
  );
}
