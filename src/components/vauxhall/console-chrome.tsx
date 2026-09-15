export function SeedBanner({ ink }: { ink?: string }) {
  return (
    <p className="vx-seed" style={{ ["--wing-ink" as string]: ink }}>
      Mock seed. Not live operations.
    </p>
  );
}

export function ConsoleHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="vx-console-head">
      <div>
        <p className="lbl" style={{ margin: "0 0 8px" }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#8E887C" }}>{subtitle}</p>
      </div>
      {right ? <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{right}</div> : null}
    </header>
  );
}
