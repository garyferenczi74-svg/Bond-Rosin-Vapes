export type LintHit = {
  kind: string;
  detail: string;
  hard: boolean;
};

export const LONG_EM = String.fromCharCode(0x2014);
export const LONG_EN = String.fromCharCode(0x2013);
export const BANG = String.fromCharCode(33);

const FORBIDDEN = ["lit", "dope", "fire", "vibes", "insane", "crazy", "banger", "epic"];
const CLAIMS = ["cure", "heal", "treat", "therapeutic", "medical", "remedy", "prevents", "prevent"];

function wordHit(hay: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(hay);
}

export function lintCopy(text: string): LintHit[] {
  const raw = text ?? "";
  const hits: LintHit[] = [];
  if (raw.includes(LONG_EM) || raw.includes(LONG_EN)) {
    hits.push({ kind: "Long dash", detail: "a long dash", hard: false });
  }
  if (raw.includes(BANG)) {
    hits.push({ kind: "Exclamation", detail: "an exclamation point", hard: false });
  }
  const vocab = FORBIDDEN.filter((word) => wordHit(raw, word));
  if (vocab.length > 0) {
    hits.push({ kind: "Vocabulary", detail: vocab.join(", "), hard: false });
  }
  const claims = CLAIMS.filter((word) => wordHit(raw, word));
  if (claims.length > 0) {
    hits.push({ kind: "Claims language", detail: claims.join(", "), hard: true });
  }
  return hits;
}

export function lintFields(fields: string[]): LintHit[] {
  return lintCopy(fields.join("  "));
}

export function lintBlocksPublish(hits: LintHit[]): boolean {
  return hits.length > 0;
}

export function lintHasHardBlock(hits: LintHit[]): boolean {
  return hits.some((hit) => hit.hard === true);
}
