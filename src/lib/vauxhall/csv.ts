import type { AgentEvent } from "./types.ts";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function eventsToCsv(events: AgentEvent[]): string {
  const rows = [["time", "agent", "type", "summary", "subline"]].concat(
    events.map((event) => [event.time, event.agent, event.type, event.summary, event.sub]),
  );
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}

export function csvFilename(now = new Date()): string {
  return `vauxhall-events-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
}

export function downloadCsv(filename: string, csv: string): void {
  downloadBlob(filename, csv, "text/csv");
}

export function downloadJson(filename: string, json: string): void {
  downloadBlob(filename, json, "application/json");
}

function downloadBlob(filename: string, body: string, type: string): void {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
