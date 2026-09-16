import type {
  TraceFacility,
  TraceItem,
  TraceLabResult,
  TracePackage,
  TracePackageInput,
  TraceProvider,
  TraceSnapshot,
  TraceSyncStatus,
  TraceTagInventory,
  TraceTestStatus,
  TraceTransfer,
  TraceTransferAttempt,
  TraceTransferDraftInput,
} from "./trace.ts";

const MOCK_LAB_NOTE = "Mock lab stub. No COA URL.";

function copyPackage(item: TracePackage): TracePackage {
  return { ...item };
}

function copyTransfer(item: TraceTransfer): TraceTransfer {
  return { ...item };
}

function copyFacility(item: TraceFacility): TraceFacility {
  return { ...item };
}

function copyItem(item: TraceItem): TraceItem {
  return { ...item };
}

function copyLab(item: TraceLabResult): TraceLabResult {
  return { ...item };
}

function copyTags(item: TraceTagInventory): TraceTagInventory {
  return {
    ...item,
    packageUids: item.packageUids.slice(),
    retailIds: item.retailIds.slice(),
  };
}

function copySync(item: TraceSyncStatus): TraceSyncStatus {
  return { ...item, lastPull: { ...item.lastPull } };
}

function seedPackages(): TracePackage[] {
  return [
    {
      uid: "MOCK-UID-D1",
      lotId: "lot-d1",
      skuId: "no-1",
      itemName: "Dialed",
      quantity: 180,
      testStatus: "TestPassed",
      packagedOn: "2026-08-12",
      location: "Prototype vault A",
      labNote: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-D-HOLD",
      lotId: "lot-d-hold",
      skuId: "no-1",
      itemName: "Dialed",
      quantity: 8,
      testStatus: "TestingRequired",
      packagedOn: "2026-09-14",
      location: "Prototype vault A",
      labNote: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-U1",
      lotId: "lot-u1",
      skuId: "no-2",
      itemName: "Unwind",
      quantity: 90,
      testStatus: "TestPassed",
      packagedOn: "2026-08-20",
      location: "Prototype vault A",
      labNote: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-P1",
      lotId: "lot-p1",
      skuId: "no-3",
      itemName: "Peak",
      quantity: 16,
      testStatus: "TestPassed",
      packagedOn: "2026-06-27",
      location: "Prototype vault B",
      labNote: MOCK_LAB_NOTE,
    },
  ];
}

function seedLabs(): TraceLabResult[] {
  return [
    {
      uid: "MOCK-UID-D1",
      status: "TestPassed",
      testedOn: "2026-08-18",
      note: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-D-HOLD",
      status: "TestingRequired",
      testedOn: "",
      note: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-U1",
      status: "TestPassed",
      testedOn: "2026-08-24",
      note: MOCK_LAB_NOTE,
    },
    {
      uid: "MOCK-UID-P1",
      status: "TestPassed",
      testedOn: "2026-07-02",
      note: MOCK_LAB_NOTE,
    },
  ];
}

function seedTransfers(): TraceTransfer[] {
  return [
    {
      id: "tr-1003",
      manifestNumber: "MOCK-MANIFEST-1003",
      fromFacilityId: "fac-bond",
      toFacilityId: "fac-north",
      orderId: "ord-1003",
      status: "shipped",
      createdOn: "2026-09-14",
    },
  ];
}

function seedFacilities(): TraceFacility[] {
  return [
    {
      id: "fac-bond",
      licenseNumber: "MOCK-LIC-PROTO-BOND",
      name: "Prototype Bond manufacturing",
      active: true,
      licensed: true,
      expiresOn: "2027-12-01",
    },
    {
      id: "fac-north",
      licenseNumber: "MOCK-LIC-PROTO-NORTH",
      name: "Prototype Dispensary North",
      active: true,
      licensed: true,
      expiresOn: "2027-06-01",
    },
    {
      id: "fac-west",
      licenseNumber: "MOCK-LIC-PROTO-WEST",
      name: "Prototype Dispensary West",
      active: true,
      licensed: true,
      expiresOn: "2026-10-20",
    },
    {
      id: "fac-lapsed",
      licenseNumber: "MOCK-LIC-PROTO-LAPSED",
      name: "Prototype Dispensary Lapsed",
      active: false,
      licensed: false,
      expiresOn: "2026-08-01",
    },
    {
      id: "fac-east",
      licenseNumber: "MOCK-LIC-PROTO-EAST",
      name: "Prototype Dispensary East",
      active: true,
      licensed: true,
      expiresOn: "2027-03-01",
    },
    {
      id: "fac-metro",
      licenseNumber: "MOCK-LIC-PROTO-METRO",
      name: "Prototype Dispensary Metro",
      active: false,
      licensed: false,
      expiresOn: "2027-08-01",
    },
  ];
}

function seedItems(): TraceItem[] {
  return [
    { id: "item-no-1", skuId: "no-1", name: "Dialed" },
    { id: "item-no-2", skuId: "no-2", name: "Unwind" },
    { id: "item-no-3", skuId: "no-3", name: "Peak" },
  ];
}

function seedTags(packages: TracePackage[]): TraceTagInventory {
  return {
    packageTags: 18,
    retailQrIds: 140,
    packageTagThreshold: 25,
    retailQrThreshold: 40,
    packageUids: packages.map((item) => item.uid),
    retailIds: ["MOCK-QR-D1-001", "MOCK-QR-U1-001", "MOCK-QR-P1-001"],
  };
}

function seedSync(): TraceSyncStatus {
  return {
    lastPull: {
      packages: "14:10",
      transfers: "14:10",
      labResults: "14:08",
      tags: "14:05",
      facilities: "14:00",
      items: "14:00",
    },
    nextScheduled: "14:25",
    stale: false,
    asOf: "14:10",
  };
}

export class MetrcMockAdapter implements TraceProvider {
  private packages: TracePackage[] = [];
  private labs: TraceLabResult[] = [];
  private transfers: TraceTransfer[] = [];
  private facilities: TraceFacility[] = [];
  private items: TraceItem[] = [];
  private tags: TraceTagInventory = seedTags([]);
  private sync: TraceSyncStatus = seedSync();
  private transferSeq = 1100;
  private readonly latencyMs: number;

  constructor(opts?: { latencyMs?: number }) {
    this.latencyMs = opts?.latencyMs ?? 40;
    this.reset();
  }

  private delay<T>(value: T): Promise<T> {
    if (this.latencyMs <= 0) return Promise.resolve(value);
    return new Promise((resolve) => {
      setTimeout(() => resolve(value), this.latencyMs);
    });
  }

  private snapshot(): TraceSnapshot {
    return {
      packages: this.packages.map(copyPackage),
      transfers: this.transfers.map(copyTransfer),
      facilities: this.facilities.map(copyFacility),
      items: this.items.map(copyItem),
      tags: copyTags(this.tags),
      labs: this.labs.map(copyLab),
      sync: copySync(this.sync),
    };
  }

  private touch(types: Array<keyof TraceSyncStatus["lastPull"]>, asOf: string): void {
    for (const type of types) this.sync.lastPull[type] = asOf;
    this.sync.asOf = asOf;
    this.sync.nextScheduled = nextQuarter(asOf);
    this.sync.stale = false;
  }

  reset(): void {
    this.packages = seedPackages();
    this.labs = seedLabs();
    this.transfers = seedTransfers();
    this.facilities = seedFacilities();
    this.items = seedItems();
    this.tags = seedTags(this.packages);
    this.sync = seedSync();
    this.transferSeq = 1100;
  }

  hydrate(): TraceSnapshot {
    return this.snapshot();
  }

  getPackages(): Promise<TracePackage[]> {
    this.touch(["packages"], this.sync.asOf);
    return this.delay(this.packages.map(copyPackage));
  }

  getPackage(uid: string): Promise<TracePackage | undefined> {
    const found = this.packages.find((item) => item.uid === uid);
    return this.delay(found ? copyPackage(found) : undefined);
  }

  getLabResults(uid: string): Promise<TraceLabResult | undefined> {
    const found = this.labs.find((item) => item.uid === uid);
    return this.delay(found ? copyLab(found) : undefined);
  }

  getTransfers(): Promise<TraceTransfer[]> {
    this.touch(["transfers"], this.sync.asOf);
    return this.delay(this.transfers.map(copyTransfer));
  }

  async createTransferDraft(input: TraceTransferDraftInput): Promise<TraceTransferAttempt> {
    const dest = this.facilities.find((item) => item.id === input.toFacilityId);
    if (!dest || !dest.active || !dest.licensed) {
      return this.delay({
        ok: false,
        reason: "Facility gate: receiving facility is not active and licensed in mock Metrc.",
      });
    }
    this.transferSeq += 1;
    const transfer: TraceTransfer = {
      id: `tr-${this.transferSeq}`,
      manifestNumber: `MOCK-MANIFEST-${this.transferSeq}`,
      fromFacilityId: input.fromFacilityId,
      toFacilityId: input.toFacilityId,
      orderId: input.orderId,
      status: "draft",
      createdOn: "2026-09-15",
    };
    this.transfers.unshift(transfer);
    this.touch(["transfers"], clockNow());
    return this.delay({ ok: true, transfer: copyTransfer(transfer) });
  }

  getFacilities(): Promise<TraceFacility[]> {
    this.touch(["facilities"], this.sync.asOf);
    return this.delay(this.facilities.map(copyFacility));
  }

  getItems(): Promise<TraceItem[]> {
    this.touch(["items"], this.sync.asOf);
    return this.delay(this.items.map(copyItem));
  }

  getTagInventory(): Promise<TraceTagInventory> {
    this.touch(["tags"], this.sync.asOf);
    return this.delay(copyTags(this.tags));
  }

  getSyncStatus(): Promise<TraceSyncStatus> {
    return this.delay(copySync(this.sync));
  }

  async registerPackage(input: TracePackageInput): Promise<TracePackage> {
    const pack: TracePackage = { ...input };
    this.packages.unshift(pack);
    this.labs.unshift({
      uid: pack.uid,
      status: pack.testStatus,
      testedOn: "",
      note: pack.labNote,
    });
    this.tags.packageUids = this.packages.map((item) => item.uid);
    this.tags.packageTags = Math.max(0, this.tags.packageTags - 1);
    this.touch(["packages", "tags", "labResults"], clockNow());
    return this.delay(copyPackage(pack));
  }

  async setLabStatus(uid: string, status: TraceTestStatus, testedOn: string): Promise<TraceLabResult> {
    const pack = this.packages.find((item) => item.uid === uid);
    if (pack) pack.testStatus = status;
    let lab = this.labs.find((item) => item.uid === uid);
    if (!lab) {
      lab = { uid, status, testedOn, note: MOCK_LAB_NOTE };
      this.labs.unshift(lab);
    } else {
      lab.status = status;
      lab.testedOn = testedOn;
    }
    this.touch(["labResults", "packages"], clockNow());
    return this.delay(copyLab(lab));
  }

  addItem(item: TraceItem): void {
    if (this.items.some((row) => row.skuId === item.skuId || row.id === item.id)) return;
    this.items.push(copyItem(item));
    this.touch(["items"], clockNow());
  }

  addFacility(facility: TraceFacility): void {
    if (this.facilities.some((row) => row.id === facility.id || row.licenseNumber === facility.licenseNumber)) {
      return;
    }
    this.facilities.push(copyFacility(facility));
    this.touch(["facilities"], clockNow());
  }

  seedDiscrepancy(uid: string, metrcQty: number): void {
    const pack = this.packages.find((item) => item.uid === uid);
    if (!pack) return;
    pack.quantity = metrcQty;
    this.touch(["packages"], clockNow());
  }

  seedStaleSync(): void {
    this.sync = {
      lastPull: {
        packages: "09:02",
        transfers: "09:02",
        labResults: "08:55",
        tags: "08:40",
        facilities: "08:40",
        items: "08:40",
      },
      nextScheduled: "09:17",
      stale: true,
      asOf: "09:02",
    };
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function clockNow(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function nextQuarter(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const hours = Number(hRaw);
  const minutes = Number(mRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm;
  const total = hours * 60 + minutes + 15;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}
