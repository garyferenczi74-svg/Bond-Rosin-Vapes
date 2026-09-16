export const VESPER_WEEKLY_AUDIT_ID = "vesper-weekly-monitor-audit";

export type WeeklyAuditItem = {
  id: string;
  prompt: string;
  state: "stub";
};

export type WeeklyAuditChecklist = {
  id: typeof VESPER_WEEKLY_AUDIT_ID;
  title: string;
  owner: "Vesper";
  cadence: "weekly";
  scheduleStub: true;
  items: WeeklyAuditItem[];
  note: string;
};

export const VESPER_WEEKLY_AUDIT: WeeklyAuditChecklist = {
  id: VESPER_WEEKLY_AUDIT_ID,
  title: "Vesper weekly monitor audit",
  owner: "Vesper",
  cadence: "weekly",
  scheduleStub: true,
  items: [
    {
      id: "rule-cite",
      prompt: "Does every monitor still test what its rule cites",
      state: "stub",
    },
    {
      id: "fire-without-finding",
      prompt: "Did anything fire without a finding",
      state: "stub",
    },
  ],
  note: "Schedule stub only. No live weekly job. Named before enablement.",
};
