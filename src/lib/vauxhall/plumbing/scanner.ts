import type { Finding, FindingSeverity, ScannerItem } from "../types.ts";
import { PHASE_B_EXECUTION_MODE } from "./flags.ts";

export type ScanFindingKind = "dependency" | "secret";

export type ScanArtifactFinding = {
  kind: ScanFindingKind;
  severity: FindingSeverity | "critical" | "high" | "medium" | "low";
  title: string;
  detail?: string;
  package?: string;
  cve?: string;
  file?: string;
};

export type ScanArtifact = {
  source?: string;
  workflow?: string;
  artifact?: string;
  generatedAt?: string;
  findings?: ScanArtifactFinding[];
};

export type ScannerIngestResult = {
  mode: typeof PHASE_B_EXECUTION_MODE;
  items: ScannerItem[];
  drafts: Omit<Finding, "id">[];
  mergeBlock: false;
};

function mapSeverity(value: ScanArtifactFinding["severity"]): FindingSeverity {
  if (value === "critical" || value === "P0") return "P0";
  if (value === "high" || value === "P1") return "P1";
  if (value === "medium" || value === "P2") return "P2";
  return "P3";
}

export function parseScanArtifact(input: unknown): ScanArtifact {
  if (typeof input !== "object" || input === null) return { findings: [] };
  const raw = input as ScanArtifact;
  return {
    source: raw.source,
    workflow: raw.workflow,
    artifact: raw.artifact,
    generatedAt: raw.generatedAt,
    findings: Array.isArray(raw.findings) ? raw.findings : [],
  };
}

export function ingestScanArtifact(input: unknown, openedOn: string): ScannerIngestResult {
  const artifact = parseScanArtifact(input);
  const source = artifact.source ?? artifact.workflow ?? "CI scan";
  const items: ScannerItem[] = [];
  const drafts: Omit<Finding, "id">[] = [];

  for (const [index, row] of (artifact.findings ?? []).entries()) {
    const severity = mapSeverity(row.severity);
    const surface = row.package ?? row.file ?? row.kind;
    const cite = row.cve ? `${row.title}. ${row.cve}.` : row.title;
    drafts.push({
      severity,
      source,
      surface,
      citation: row.kind === "secret" ? "Secret pattern from CI scan." : "Dependency CVE from CI scan.",
      owner: "Felix",
      due: openedOn,
      cite,
      remediate: "Review the draft. Scan-on-commit merge block stays off.",
      document: "Dry-run scanner ingest. Same shape as a live finding. Not opened on the live scorecard.",
      state: "open",
      closedEvidence: "",
      openedOn,
      escape: false,
      monitorId: "dependency-secret",
    });
    items.push({
      id: `scan-dry-${index + 1}`,
      source,
      note: row.detail ?? row.title,
      findingId: `draft-${index + 1}`,
      lastSweep: artifact.generatedAt ?? openedOn,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "scan-dry-empty",
      source,
      note: "CI artifact read. No draft findings in this payload.",
      findingId: "none",
      lastSweep: artifact.generatedAt ?? openedOn,
    });
  }

  return {
    mode: PHASE_B_EXECUTION_MODE,
    items,
    drafts,
    mergeBlock: false,
  };
}
