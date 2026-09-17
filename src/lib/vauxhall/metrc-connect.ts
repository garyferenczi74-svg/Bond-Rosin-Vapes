import {
  metrcBasicAuthHeader,
  metrcSandboxEnvFromLookup,
  readMetrcSandboxConfig,
  type MetrcSandboxEnv,
} from "./metrc-env.ts";
import { isMetrcConnectEnabled, type MetrcEnvLookup } from "./metrc-flags.ts";
import { payloadHasForbiddenNotes, regulatoryTransferFields } from "./metrc-payload.ts";
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

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const ITEM_SKU: Record<string, string> = {
  dialed: "no-1",
  unwind: "no-2",
  peak: "no-3",
};

const EMPTY_TAGS: TraceTagInventory = {
  packageTags: 0,
  retailQrIds: 0,
  packageTagThreshold: 0,
  retailQrThreshold: 0,
  packageUids: [],
  retailIds: [],
};

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

function emptySync(asOf = "none"): TraceSyncStatus {
  return {
    lastPull: {
      packages: "",
      transfers: "",
      labResults: "",
      tags: "",
      facilities: "",
      items: "",
    },
    nextScheduled: asOf === "none" ? "" : nextQuarter(asOf),
    stale: true,
    asOf,
  };
}

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (rec && Array.isArray(rec.Data)) return rec.Data;
  if (rec && Array.isArray(rec.data)) return rec.data;
  return [];
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function dateOnly(value: unknown): string {
  const raw = textOf(value);
  return raw.slice(0, 10);
}

function mapTestStatus(raw: unknown): TraceTestStatus {
  const value = textOf(raw).toLowerCase().replace(/\s+/g, "");
  if (value === "testpassed" || value === "passed") return "TestPassed";
  if (value === "retestpassed") return "RetestPassed";
  if (value === "failed" || value === "testfailed") return "Failed";
  return "TestingRequired";
}

function mapSkuId(name: string): string {
  const key = name.toLowerCase();
  for (const [token, skuId] of Object.entries(ITEM_SKU)) {
    if (key.includes(token)) return skuId;
  }
  return "";
}

function mapPackage(raw: unknown): TracePackage | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const item = asRecord(rec.Item) ?? asRecord(rec.item);
  const uid = textOf(rec.Label) || textOf(rec.label) || textOf(rec.Tag) || textOf(rec.Id);
  if (!uid) return null;
  const itemName = textOf(item?.Name) || textOf(rec.ItemName) || textOf(rec.itemName) || uid;
  return {
    uid,
    lotId: textOf(rec.Id) || uid,
    skuId: mapSkuId(itemName),
    itemName,
    quantity: Number(rec.Quantity ?? rec.quantity ?? 0) || 0,
    testStatus: mapTestStatus(rec.LabTestingState ?? rec.labTestingState ?? rec.TestStatus),
    packagedOn: dateOnly(rec.PackagedDate ?? rec.packagedDate),
    location: textOf(rec.LocationName ?? rec.locationName ?? rec.Location),
    labNote: "",
  };
}

function mapFacility(raw: unknown): TraceFacility | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const license = asRecord(rec.License) ?? asRecord(rec.license);
  const licenseNumber =
    textOf(rec.LicenseNumber) || textOf(rec.licenseNumber) || textOf(license?.Number) || textOf(license?.number);
  const id = textOf(rec.Id) || textOf(rec.FacilityId) || licenseNumber;
  if (!id && !licenseNumber) return null;
  const expiresOn = dateOnly(rec.ExpirationDate ?? rec.expiresOn ?? license?.EndDate ?? license?.ExpirationDate);
  const expired = expiresOn ? Date.parse(`${expiresOn}T00:00:00Z`) < Date.now() : false;
  const activeRaw = rec.IsActive ?? rec.active ?? rec.Active;
  const licensedRaw = rec.IsLicensed ?? rec.licensed ?? rec.Licensed;
  return {
    id: id || licenseNumber,
    licenseNumber: licenseNumber || id,
    name: textOf(rec.DisplayName ?? rec.Name ?? rec.name ?? rec.FacilityName) || licenseNumber || id,
    active: activeRaw === undefined ? !expired : Boolean(activeRaw) && !expired,
    licensed: licensedRaw === undefined ? !expired : Boolean(licensedRaw) && !expired,
    expiresOn,
  };
}

function mapItem(raw: unknown): TraceItem | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const name = textOf(rec.Name ?? rec.name);
  if (!name) return null;
  return {
    id: textOf(rec.Id ?? rec.id) || name,
    skuId: mapSkuId(name),
    name,
  };
}

function mapTransfer(raw: unknown): TraceTransfer | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const dest = asRecord(rec.Delivery) ?? asRecord(asList(rec.Deliveries)[0]);
  const id = textOf(rec.Id ?? rec.id);
  const manifest = textOf(rec.ManifestNumber ?? rec.manifestNumber ?? rec.ExternalManifestNumber) || id;
  if (!id && !manifest) return null;
  return {
    id: id || manifest,
    manifestNumber: manifest || id,
    fromFacilityId: textOf(rec.ShipperFacilityLicenseNumber ?? rec.fromFacilityId ?? rec.ShipperFacilityId),
    toFacilityId: textOf(
      dest?.RecipientFacilityLicenseNumber ?? dest?.LicenseNumber ?? rec.RecipientFacilityLicenseNumber ?? rec.toFacilityId,
    ),
    orderId: textOf(rec.ExternalId ?? rec.orderId),
    status: textOf(rec.DeliveryStatus ?? rec.Status ?? rec.status) || "draft",
    createdOn: dateOnly(rec.CreatedDateTime ?? rec.createdOn ?? rec.LastModified),
  };
}

function mapLab(raw: unknown, uid: string): TraceLabResult | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const label = textOf(rec.PackageLabel ?? rec.Label ?? rec.uid) || uid;
  return {
    uid: label,
    status: mapTestStatus(rec.LabTestResult ?? rec.OverallPassed ?? rec.TestStatus ?? rec.status),
    testedOn: dateOnly(rec.ResultDate ?? rec.TestedDateTime ?? rec.testedOn),
    note: "",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transferTemplateBody(input: TraceTransferDraftInput, destinationLicense: string): unknown[] {
  const fields = regulatoryTransferFields(input);
  const departure = new Date();
  const arrival = new Date(departure.getTime() + 4 * 60 * 60 * 1000);
  return [
    {
      Name: `Bond ${fields.orderId}`,
      Destinations: [
        {
          LicenseNumber: destinationLicense,
          TransferTypeName: "Wholesale",
          PlannedRoute: "Operator confirmed",
          EstimatedDepartureDateTime: departure.toISOString(),
          EstimatedArrivalDateTime: arrival.toISOString(),
          Packages: fields.packages.map((row) => ({
            PackageLabel: row.label,
            WholesalePrice: null,
          })),
        },
      ],
    },
  ];
}

export class MetrcConnectAdapter implements TraceProvider {
  private packages: TracePackage[] = [];
  private labs: TraceLabResult[] = [];
  private transfers: TraceTransfer[] = [];
  private facilities: TraceFacility[] = [];
  private items: TraceItem[] = [];
  private tags: TraceTagInventory = copyTags(EMPTY_TAGS);
  private sync: TraceSyncStatus = emptySync();
  private readonly env: MetrcSandboxEnv;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;
  private transferSeq = 2000;

  constructor(opts?: { env?: MetrcEnvLookup; fetchImpl?: FetchLike; now?: () => Date }) {
    if (typeof window !== "undefined") {
      throw new Error("MetrcConnectAdapter is server-only.");
    }
    this.env = metrcSandboxEnvFromLookup(opts?.env);
    this.fetchImpl = opts?.fetchImpl ?? fetch;
    this.now = opts?.now ?? (() => new Date());
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

  private markPull(types: Array<keyof TraceSyncStatus["lastPull"]>, ok: boolean): void {
    const asOf = clockNow(this.now());
    for (const type of types) this.sync.lastPull[type] = ok ? asOf : this.sync.lastPull[type];
    if (ok) {
      this.sync.asOf = asOf;
      this.sync.nextScheduled = nextQuarter(asOf);
    } else if (!this.sync.asOf) {
      this.sync.asOf = "none";
    }
    const fresh = Boolean(this.sync.asOf && this.sync.asOf !== "none");
    this.sync.stale = !ok || !fresh;
    this.sync.nextScheduled = this.sync.nextScheduled || nextQuarter(asOf);
  }

  private async request(path: string, init?: RequestInit): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
    const config = readMetrcSandboxConfig(this.env);
    if (!config.ok) return config;
    const url = new URL(path, `${config.baseUrl}/`);
    if (!url.searchParams.get("licenseNumber")) {
      url.searchParams.set("licenseNumber", config.facilityLicense);
    }
    let lastReason = "Sandbox request failed.";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetchImpl(url.toString(), {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: metrcBasicAuthHeader(config.vendorKey, config.userKey),
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        await sleep(Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : 2 ** attempt * 1000);
        continue;
      }
      const text = await response.text();
      if (!response.ok) {
        lastReason = `Sandbox Metrc returned ${response.status}.`;
        break;
      }
      if (!text.trim()) return { ok: true, body: null };
      try {
        return { ok: true, body: JSON.parse(text) as unknown };
      } catch {
        return { ok: false, reason: "Sandbox Metrc returned a non-JSON body." };
      }
    }
    return { ok: false, reason: lastReason };
  }

  private async pullPackages(): Promise<boolean> {
    const result = await this.request("/packages/v2/active");
    if (!result.ok) {
      this.markPull(["packages", "labResults"], false);
      return false;
    }
    this.packages = asList(result.body).map(mapPackage).filter((item): item is TracePackage => Boolean(item));
    this.labs = this.packages.map((item) => ({
      uid: item.uid,
      status: item.testStatus,
      testedOn: item.packagedOn,
      note: "",
    }));
    this.markPull(["packages", "labResults"], true);
    return true;
  }

  hydrate(): TraceSnapshot {
    return this.snapshot();
  }

  async getPackages(): Promise<TracePackage[]> {
    await this.pullPackages();
    return this.packages.map(copyPackage);
  }

  async getPackage(uid: string): Promise<TracePackage | undefined> {
    if (!this.packages.length) await this.pullPackages();
    const found = this.packages.find((item) => item.uid === uid || item.lotId === uid);
    return found ? copyPackage(found) : undefined;
  }

  async getLabResults(uid: string): Promise<TraceLabResult | undefined> {
    if (!this.labs.length) await this.pullPackages();
    const found = this.labs.find((item) => item.uid === uid);
    if (found) return copyLab(found);
    const result = await this.request(`/labtests/v2/results`);
    if (result.ok) {
      const mapped = asList(result.body)
        .map((row) => mapLab(row, uid))
        .find((row) => row && row.uid === uid);
      if (mapped) return copyLab(mapped);
    }
    return undefined;
  }

  async getTransfers(): Promise<TraceTransfer[]> {
    const result = await this.request("/transfers/v2/outgoing");
    if (!result.ok) {
      this.markPull(["transfers"], false);
      return this.transfers.map(copyTransfer);
    }
    this.transfers = asList(result.body).map(mapTransfer).filter((item): item is TraceTransfer => Boolean(item));
    this.markPull(["transfers"], true);
    return this.transfers.map(copyTransfer);
  }

  async createTransferDraft(input: TraceTransferDraftInput): Promise<TraceTransferAttempt> {
    if (!isMetrcConnectEnabled(this.env)) {
      return { ok: false, reason: "Connect adapter is off. METRC_ADAPTER=connect is preview only." };
    }
    if (input.operatorConfirmed !== true) {
      return { ok: false, reason: "Confirm required: operator must confirm this Metrc transfer draft." };
    }
    const fields = regulatoryTransferFields(input);
    if (payloadHasForbiddenNotes(input) || payloadHasForbiddenNotes(fields)) {
      return { ok: false, reason: "Transfer payload rejected: free-text notes are not allowed." };
    }
    const dest =
      this.facilities.find((item) => item.id === fields.toFacilityId || item.licenseNumber === fields.destinationLicense) ??
      this.facilities.find((item) => item.licenseNumber === fields.toFacilityId);
    if (dest && (!dest.active || !dest.licensed)) {
      return { ok: false, reason: "Facility gate: receiving facility is not active and licensed." };
    }
    if (dest?.expiresOn) {
      const expires = Date.parse(`${dest.expiresOn}T00:00:00Z`);
      if (Number.isFinite(expires) && expires < this.now().getTime()) {
        return { ok: false, reason: "License gate: Expired license. Transfer blocked." };
      }
    }
    const destinationLicense = fields.destinationLicense || dest?.licenseNumber || fields.toFacilityId;
    if (!destinationLicense) {
      return { ok: false, reason: "Facility gate: no Metrc facility on the account." };
    }
    const body = transferTemplateBody(input, destinationLicense);
    if (payloadHasForbiddenNotes(body)) {
      return { ok: false, reason: "Transfer payload rejected: free-text notes are not allowed." };
    }
    const config = readMetrcSandboxConfig(this.env);
    if (!config.ok) return { ok: false, reason: config.reason };
    const posted = await this.request("/transfers/v2/templates/outgoing", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!posted.ok) return { ok: false, reason: posted.reason };
    this.transferSeq += 1;
    const rec = asRecord(asList(posted.body)[0]) ?? asRecord(posted.body);
    const transfer: TraceTransfer = {
      id: textOf(rec?.Id ?? rec?.id) || `tr-sandbox-${this.transferSeq}`,
      manifestNumber:
        textOf(rec?.ManifestNumber ?? rec?.manifestNumber) || `SANDBOX-DRAFT-${fields.orderId}-${this.transferSeq}`,
      fromFacilityId: fields.fromFacilityId,
      toFacilityId: dest?.id || fields.toFacilityId || destinationLicense,
      orderId: fields.orderId,
      status: "draft",
      createdOn: dateOnly(this.now().toISOString()),
    };
    if (payloadHasForbiddenNotes(transfer)) {
      return { ok: false, reason: "Transfer payload rejected: free-text notes are not allowed." };
    }
    this.transfers.unshift(transfer);
    this.markPull(["transfers"], true);
    return { ok: true, transfer: copyTransfer(transfer) };
  }

  async getFacilities(): Promise<TraceFacility[]> {
    const result = await this.request("/facilities/v2");
    if (!result.ok) {
      this.markPull(["facilities"], false);
      return this.facilities.map(copyFacility);
    }
    this.facilities = asList(result.body).map(mapFacility).filter((item): item is TraceFacility => Boolean(item));
    this.markPull(["facilities"], true);
    return this.facilities.map(copyFacility);
  }

  async getItems(): Promise<TraceItem[]> {
    const result = await this.request("/items/v2/active");
    if (!result.ok) {
      this.markPull(["items"], false);
      return this.items.map(copyItem);
    }
    this.items = asList(result.body).map(mapItem).filter((item): item is TraceItem => Boolean(item));
    this.markPull(["items"], true);
    return this.items.map(copyItem);
  }

  async getTagInventory(): Promise<TraceTagInventory> {
    const result = await this.request("/tags/v2/package/available");
    if (!result.ok) {
      this.markPull(["tags"], false);
      return copyTags(this.tags);
    }
    const rows = asList(result.body).map((row) => textOf(asRecord(row)?.Label ?? asRecord(row)?.label)).filter(Boolean);
    this.tags = {
      packageTags: rows.length,
      retailQrIds: 0,
      packageTagThreshold: 0,
      retailQrThreshold: 0,
      packageUids: rows,
      retailIds: [],
    };
    this.markPull(["tags"], true);
    return copyTags(this.tags);
  }

  async getSyncStatus(): Promise<TraceSyncStatus> {
    if (!this.sync.asOf || this.sync.asOf === "none") {
      this.sync = emptySync();
    }
    return copySync(this.sync);
  }

  async refreshAll(): Promise<TraceSnapshot> {
    await Promise.all([
      this.getPackages(),
      this.getTransfers(),
      this.getFacilities(),
      this.getItems(),
      this.getTagInventory(),
    ]);
    const failed = this.sync.stale;
    if (!failed) this.sync.stale = false;
    return this.snapshot();
  }

  async registerPackage(_input: TracePackageInput): Promise<TracePackage> {
    throw new Error("Connect mode does not mint mock packages.");
  }

  async setLabStatus(_uid: string, _status: TraceTestStatus, _testedOn: string): Promise<TraceLabResult> {
    throw new Error("Connect mode does not flip mock lab results.");
  }

  addItem(_item: TraceItem): void {
    return;
  }

  addFacility(_facility: TraceFacility): void {
    return;
  }

  seedDiscrepancy(_uid: string, _metrcQty: number): void {
    return;
  }

  seedStaleSync(): void {
    return;
  }

  reset(): void {
    this.packages = [];
    this.labs = [];
    this.transfers = [];
    this.facilities = [];
    this.items = [];
    this.tags = copyTags(EMPTY_TAGS);
    this.sync = emptySync();
    this.transferSeq = 2000;
  }
}
