export function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="vx-metric">
      <p className="lbl" style={{ margin: 0 }}>
        {label}
      </p>
      <div className="vx-metric-value">{value}</div>
      <p className="vx-metric-sub">{sub}</p>
    </div>
  );
}
