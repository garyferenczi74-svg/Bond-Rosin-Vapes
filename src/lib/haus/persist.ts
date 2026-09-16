import { seedHausPersist } from "./seed.ts";
import { PRIVACY_WALL, type HausPersist } from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseHausPersist(raw: string | null | undefined): HausPersist {
  const fallback = seedHausPersist();
  if (raw == null || raw === "") return fallback;
  try {
    const value = JSON.parse(raw) as unknown;
    if (isRecord(value) === false) return fallback;
    const houseWrites = Array.isArray(value.houseWrites) ? value.houseWrites : fallback.houseWrites;
    const invitations = Array.isArray(value.invitations) ? value.invitations : fallback.invitations;
    const hausList = Array.isArray(value.hausList) ? value.hausList : fallback.hausList;
    const accounts = Array.isArray(value.accounts) ? value.accounts : fallback.accounts;
    const audit = Array.isArray(value.audit) ? value.audit : fallback.audit;
    const counts = isRecord(value.counts) ? value.counts : fallback.counts;
    const settings = isRecord(value.settings) ? value.settings : fallback.settings;
    return {
      houseWrites: houseWrites.filter(isRecord).map((row) => ({
        id: asString(row.id),
        title: asString(row.title),
        body: asString(row.body),
        link: asString(row.link) as HausPersist["houseWrites"][number]["link"],
        from: asString(row.from),
        until: asString(row.until),
        order: asNumber(row.order, 0),
        state: asString(row.state, "draft") as HausPersist["houseWrites"][number]["state"],
      })),
      invitations: invitations.filter(isRecord).map((row) => ({
        email: asString(row.email).trim().toLowerCase(),
        state: asString(row.state, "issued") as HausPersist["invitations"][number]["state"],
        issued: asString(row.issued),
        expires: asString(row.expires),
      })),
      hausList: hausList.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()),
      accounts: accounts.filter(isRecord).map((row) => ({
        email: asString(row.email).trim().toLowerCase(),
        state: asString(row.state, "active") as HausPersist["accounts"][number]["state"],
      })),
      counts: {
        activeShelves: asNumber(counts.activeShelves, fallback.counts.activeShelves),
        ritualsThisMonth: asNumber(counts.ritualsThisMonth, fallback.counts.ritualsThisMonth),
        notesHeld: asNumber(counts.notesHeld, fallback.counts.notesHeld),
      },
      settings: {
        invitationWindow: asBool(settings.invitationWindow, true),
        registrationPause: asBool(settings.registrationPause, false),
        welcomeText: asString(settings.welcomeText, fallback.settings.welcomeText),
        privacyWall: PRIVACY_WALL,
      },
      audit: audit.filter(isRecord).map((row) => ({
        ts: asString(row.ts),
        actor: asString(row.actor, "Gary"),
        action: asString(row.action),
        before: asString(row.before),
        after: asString(row.after),
      })),
    };
  } catch {
    return fallback;
  }
}

export function serializeHausPersist(data: HausPersist): string {
  return JSON.stringify({
    ...data,
    settings: { ...data.settings, privacyWall: PRIVACY_WALL },
  });
}
