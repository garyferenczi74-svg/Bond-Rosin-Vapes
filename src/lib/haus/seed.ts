import { isoDay } from "./dates.ts";
import { PRIVACY_WALL, type HausPersist } from "./types.ts";
import type {
  HausBatchPreview,
  HausEventPreview,
  HausGuidePreview,
  HausReservePreview,
} from "./types.ts";

export const DEFAULT_WELCOME =
  "This floor is yours. Your shelf, your guide, your rituals, kept quietly.";

export const SEED_BATCHES: HausBatchPreview[] = [
  {
    batch: "BND-1-0518",
    title: "No. 1 Dialed",
    body: "Sunrise Runtz",
    state: "published",
    coa: "COA-0518",
    shelfCount: 9,
  },
  {
    batch: "BND-3-0214",
    title: "No. 3 Peak",
    body: "Midnight Zkittlez",
    state: "published",
    coa: "COA-0214",
    shelfCount: 14,
  },
  {
    batch: "BND-1-0603",
    title: "No. 1 Dialed",
    body: "Morning Mimosa",
    state: "draft",
    coa: "",
    shelfCount: 0,
  },
];

export const SEED_EVENTS: HausEventPreview[] = [
  { id: "ev1", name: "An Evening of Three", confirmed: 37, capacity: 40, state: "open" },
  { id: "ev2", name: "The Listening Room", confirmed: 12, capacity: 30, state: "open" },
  { id: "ev3", name: "Harvest Supper", confirmed: 24, capacity: 24, state: "past" },
];

export const SEED_GUIDE: HausGuidePreview[] = [
  { id: "cover", title: "The Experience Guide", body: "", state: "published" },
  { id: "notes", title: "On Notes", body: "A note is a memory before it is a smell.", state: "published" },
  { id: "ritual", title: "The Ritual", body: "Prepare. Pause. Close.", state: "draft" },
];

export const SEED_RESERVE: HausReservePreview[] = [
  { id: "run-mz", cultivar: "Midnight Zkittlez", claimed: 214, size: 1000, state: "open" },
  { id: "run-ag", cultivar: "Autumn Gelato", claimed: 500, size: 500, state: "ended" },
];

export function seedHausPersist(now = new Date()): HausPersist {
  return {
    houseWrites: [
      {
        id: "HW-1",
        title: "A Reserve run has been pressed",
        body: "A Reserve run has been pressed. No. 3 Peak.",
        link: "reserve",
        from: isoDay(-27, now),
        until: "",
        order: 1,
        state: "published",
      },
      {
        id: "HW-2",
        title: "The Experience Guide",
        body: "Chapter On Notes is open.",
        link: "guide",
        from: isoDay(-29, now),
        until: "",
        order: 2,
        state: "published",
      },
      {
        id: "HW-3",
        title: "The cleanest press",
        body: "A bright press, made with care.",
        link: "",
        from: "",
        until: "",
        order: 3,
        state: "draft",
      },
      {
        id: "HW-4",
        title: "A quiet press",
        body: "A press kept for the end of the day.",
        link: "",
        from: "",
        until: "",
        order: 4,
        state: "draft",
      },
    ],
    invitations: [
      {
        email: "haus-1@example.com",
        state: "issued",
        issued: isoDay(-3, now),
        expires: isoDay(27, now),
      },
      {
        email: "haus-2@example.com",
        state: "issued",
        issued: isoDay(-10, now),
        expires: isoDay(3, now),
      },
      {
        email: "haus-3@example.com",
        state: "accepted",
        issued: isoDay(-20, now),
        expires: isoDay(10, now),
      },
      {
        email: "haus-4@example.com",
        state: "expired",
        issued: isoDay(-40, now),
        expires: isoDay(-10, now),
      },
    ],
    hausList: ["haus-5@example.com", "haus-6@example.com", "haus-7@example.com"],
    accounts: [
      { email: "member@bond.test", state: "active" },
      { email: "nora@example.com", state: "active" },
      { email: "ellis@example.com", state: "suspended" },
    ],
    counts: {
      activeShelves: 2,
      ritualsThisMonth: 11,
      notesHeld: 14,
    },
    settings: {
      invitationWindow: true,
      registrationPause: false,
      welcomeText: DEFAULT_WELCOME,
      privacyWall: PRIVACY_WALL,
    },
    audit: [
      {
        ts: `${isoDay(0, now)} 09:02:11`,
        actor: "Gary",
        action: "Published House Write HW-1",
        before: "draft",
        after: "published",
      },
      {
        ts: `${isoDay(0, now)} 09:05:40`,
        actor: "Gary",
        action: "Published batch BND-3-0214",
        before: "draft",
        after: "published",
      },
    ],
  };
}
