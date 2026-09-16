export function isoDay(offset = 0, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + offset));
  return d.toISOString().slice(0, 10);
}

export function daysUntil(date: string, from = new Date()): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.parse(`${date}T00:00:00Z`);
  if (Number.isFinite(end) === false) return 0;
  return Math.round((end - start) / 86400000);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function clockStamp(now = new Date()): string {
  return `${isoDay(0, now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
