export const TRACE_TEST_STATUSES = [
  "TestingRequired",
  "TestPassed",
  "RetestPassed",
  "Failed",
] as const;
export type TraceTestStatus = (typeof TRACE_TEST_STATUSES)[number];

export const TRACE_OBJECT_TYPES = [
  "packages",
  "transfers",
  "labResults",
  "tags",
  "facilities",
  "items",
] as const;
export type TraceObjectType = (typeof TRACE_OBJECT_TYPES)[number];

export type TracePackage = {
  uid: string;
  lotId: string;
  skuId: string;
  itemName: string;
  quantity: number;
  testStatus: TraceTestStatus;
  packagedOn: string;
  location: string;
  labNote: string;
};

export type TraceLabResult = {
  uid: string;
  status: TraceTestStatus;
  testedOn: string;
  note: string;
};

export type TraceTransfer = {
  id: string;
  manifestNumber: string;
  fromFacilityId: string;
  toFacilityId: string;
  orderId: string;
  status: string;
  createdOn: string;
};

export type TraceFacility = {
  id: string;
  licenseNumber: string;
  name: string;
  active: boolean;
  licensed: boolean;
  expiresOn: string;
};

export type TraceItem = {
  id: string;
  skuId: string;
  name: string;
};

export type TraceTagInventory = {
  packageTags: number;
  retailQrIds: number;
  packageTagThreshold: number;
  retailQrThreshold: number;
  packageUids: string[];
  retailIds: string[];
};

export type TraceSyncStatus = {
  lastPull: Record<TraceObjectType, string>;
  nextScheduled: string;
  stale: boolean;
  asOf: string;
};

export type TraceSnapshot = {
  packages: TracePackage[];
  transfers: TraceTransfer[];
  facilities: TraceFacility[];
  items: TraceItem[];
  tags: TraceTagInventory;
  labs: TraceLabResult[];
  sync: TraceSyncStatus;
};

export type TraceTransferDraftInput = {
  orderId: string;
  fromFacilityId: string;
  toFacilityId: string;
  operatorConfirmed?: boolean;
  destinationLicense?: string;
  packages?: Array<{ label: string; quantity: number }>;
};

export type TraceTransferAttempt =
  | { ok: true; transfer: TraceTransfer }
  | { ok: false; reason: string };

export type TracePackageInput = {
  uid: string;
  lotId: string;
  skuId: string;
  itemName: string;
  quantity: number;
  testStatus: TraceTestStatus;
  packagedOn: string;
  location: string;
  labNote: string;
};

export const DISCREPANCY_THRESHOLD_PCT = 2;

export function isAllocatableStatus(status: TraceTestStatus): boolean {
  return status === "TestPassed" || status === "RetestPassed";
}

export function variancePercent(erpQty: number, metrcQty: number): number {
  const base = Math.max(Math.abs(metrcQty), 1);
  return (Math.abs(erpQty - metrcQty) / base) * 100;
}

export function metrcStamp(sync: TraceSyncStatus): string {
  return sync.stale ? `Metrc as of ${sync.asOf} . stale` : `Metrc as of ${sync.asOf}`;
}

export type TraceProvider = {
  getPackages(): Promise<TracePackage[]>;
  getPackage(uid: string): Promise<TracePackage | undefined>;
  getLabResults(uid: string): Promise<TraceLabResult | undefined>;
  getTransfers(): Promise<TraceTransfer[]>;
  createTransferDraft(input: TraceTransferDraftInput): Promise<TraceTransferAttempt>;
  getFacilities(): Promise<TraceFacility[]>;
  getItems(): Promise<TraceItem[]>;
  getTagInventory(): Promise<TraceTagInventory>;
  getSyncStatus(): Promise<TraceSyncStatus>;
  hydrate(): TraceSnapshot;
  registerPackage(input: TracePackageInput): Promise<TracePackage>;
  setLabStatus(uid: string, status: TraceTestStatus, testedOn: string): Promise<TraceLabResult>;
  addItem(item: TraceItem): void;
  addFacility(facility: TraceFacility): void;
  seedDiscrepancy(uid: string, metrcQty: number): void;
  seedStaleSync(): void;
  reset(): void;
};
