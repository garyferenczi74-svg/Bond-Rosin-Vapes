export const HAUS_LEDGER_COOKIE = "bond_haus_ledger";

export const PRIVACY_WALL =
  "The house does not read the guest book. Member tasting notes, ritual reflections, and session histories are structurally unreadable from any admin context. There is no override.";

export type PublishState = "draft" | "published" | "retired";
export type InviteState = "issued" | "accepted" | "expired" | "revoked";
export type AccountState = "active" | "suspended" | "erased";
export type WriteLink = "" | "guide" | "reserve" | "events";

export type HouseWrite = {
  id: string;
  title: string;
  body: string;
  link: WriteLink;
  from: string;
  until: string;
  order: number;
  state: PublishState;
};

export type HausInvitation = {
  email: string;
  state: InviteState;
  issued: string;
  expires: string;
};

export type HausAccount = {
  email: string;
  state: AccountState;
};

export type HausSettings = {
  invitationWindow: boolean;
  registrationPause: boolean;
  welcomeText: string;
  privacyWall: string;
};

export type HausAudit = {
  ts: string;
  actor: string;
  action: string;
  before: string;
  after: string;
};

export type HausCounts = {
  activeShelves: number;
  ritualsThisMonth: number;
  notesHeld: number;
};

export type HausPersist = {
  houseWrites: HouseWrite[];
  invitations: HausInvitation[];
  hausList: string[];
  accounts: HausAccount[];
  counts: HausCounts;
  settings: HausSettings;
  audit: HausAudit[];
};

export type HausBatchPreview = {
  batch: string;
  title: string;
  body: string;
  state: PublishState;
  coa: string;
  shelfCount: number;
};

export type HausEventPreview = {
  id: string;
  name: string;
  confirmed: number;
  capacity: number;
  state: "draft" | "open" | "full" | "past" | "retired";
};

export type HausGuidePreview = {
  id: string;
  title: string;
  body: string;
  state: PublishState;
};

export type HausReservePreview = {
  id: string;
  cultivar: string;
  claimed: number;
  size: number;
  state: "open" | "ended";
};

export type HausAttention = {
  kind: string;
  text: string;
  href: string;
  resolve: "phase-a" | "parked";
};

export type HausBoardRow = {
  id: string;
  label: string;
  href: string;
  live: boolean;
  draft: number;
  published: number;
  retired: number;
  lintBlocked: number;
};

export type HausDashboard = {
  activeMembers: number;
  invitationsOut: number;
  shelvesHolding: number;
  ritualsThisMonth: number;
  notesHeld: number;
  houseWritesLive: number;
  board: HausBoardRow[];
  invitationFunnel: {
    issued: number;
    accepted: number;
    expired: number;
    conversion: number;
  };
  events: HausEventPreview[];
  reserve: HausReservePreview | null;
  attention: HausAttention[];
  activity: HausAudit[];
};
