import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

type Carrier = {
  lic?: string;
  name?: string;
  city?: string;
  addr?: string;
  region?: string;
  lat?: number;
  lng?: number;
  bond?: boolean;
  verified?: boolean;
};

type WaitlistRun = { id: string; name: string; line: string; size: number };

type CarrierApi = {
  CARRIER_EMPTY: string;
  WAITLIST_CONFIRM: string;
  bondCarriers: () => Carrier[];
  readVerifiedCarriers: () => Carrier[];
  isVerifiedCarrier: (row: Carrier) => boolean;
  pickupForHold: (lic: string | null, city: string) => { lic: string; name: string; city: string };
  carrierListHtml: (cityEsc: string, nearestCount: number, picksHtml: string) => string;
  joinWaitlist: (runId: string) => boolean;
  isWaitlisted: (runId: string) => boolean;
  waitlistRunHtml: (run: WaitlistRun, accent: string, open: boolean, joined: boolean) => string;
};

function carrierBlock(html: string) {
  const start = html.indexOf("// CARRIERS_START");
  const end = html.indexOf("// CARRIERS_END");
  assert.ok(start !== -1 && end > start, "carrier seam markers");
  return html.slice(start, end);
}

function loadCarriers(storage: Record<string, string>): CarrierApi {
  const html = read("Haus.dc.html");
  const block = carrierBlock(html);
  const poison: Carrier[] = [
    {
      lic: "OCM-AUR-0101",
      name: "Empire Botanical Co",
      city: "New York",
      lat: 40.7128,
      lng: -74.006,
      bond: true,
    },
    {
      name: "Sample Dispensary 01",
      city: "New York",
      addr: "Sample area 01",
      lat: 40.7128,
      lng: -74.006,
      bond: false,
    },
  ];
  const sandbox = vm.createContext({
    localStorage: {
      getItem(key: string) {
        return Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null;
      },
    },
    readJSON(key: string) {
      const raw = storage[key];
      if (raw) return JSON.parse(raw);
      return poison;
    },
    esc(value: unknown) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    },
  });
  vm.runInContext(block, sandbox);
  return sandbox as unknown as CarrierApi;
}

const staleDirectory = [
  {
    lic: "OCM-AUR-0101",
    name: "Empire Botanical Co",
    city: "New York",
    lat: 40.7128,
    lng: -74.006,
    bond: true,
  },
  {
    lic: "OCM-AUR-0701",
    name: "Queen City Cannabis",
    city: "Buffalo",
    lat: 42.8864,
    lng: -78.8784,
    bond: true,
  },
];

const finderSamples = [
  {
    name: "Sample Dispensary 01",
    city: "New York",
    addr: "Sample area 01",
    lat: 40.7128,
    lng: -74.006,
    bond: false,
  },
  {
    name: "Sample Dispensary 19",
    city: "Albany",
    addr: "Sample area 19",
    region: "Sample area 19",
    lat: 42.6526,
    lng: -73.7562,
    bond: true,
    verified: true,
  },
];

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
      continue;
    }
    out.push(path);
  }
}

test("Haus carrier seam stays empty when storage holds stale or sample rows", () => {
  const haus = read("Haus.dc.html");
  const block = carrierBlock(haus);
  assert.equal(block.includes("localStorage.getItem"), false);
  assert.equal(block.includes("localStorage.setItem"), false);
  assert.equal(block.includes("bondDispensaryDir"), false);
  assert.equal(block.includes("bondBondCarriers"), false);
  assert.equal(block.includes("readJSON"), false);
  assert.equal(block.includes("FALLBACK_CARRIERS"), false);
  assert.equal(haus.includes("OCM-AUR"), false);
  assert.equal(/bond:\s*true/.test(haus), false);
  assert.equal(haus.includes("FALLBACK_CARRIERS"), false);
  assert.equal(haus.includes("Empire Botanical"), false);

  const storage = {
    bondDispensaryDir: JSON.stringify(staleDirectory.concat(finderSamples)),
    bondBondCarriers: JSON.stringify(["OCM-AUR-0101", "OCM-AUR-0701", "Sample Dispensary 01"]),
  };
  const api = loadCarriers(storage);
  assert.equal(api.CARRIER_EMPTY, "No shops carrying Bond yet");
  assert.equal(api.readVerifiedCarriers().length, 0);
  assert.equal(api.bondCarriers().length, 0);
  const empty = api.carrierListHtml("Albany", 0, "<button>Sample Dispensary 01</button>");
  assert.equal(empty.includes("No shops carrying Bond yet"), true);
  assert.equal(empty.includes("Sample Dispensary"), false);
  assert.equal(empty.includes("Empire Botanical"), false);
  assert.equal(empty.includes("OCM-AUR"), false);
  const held = api.pickupForHold("OCM-AUR-0101", "Albany");
  assert.equal(held.lic, "");
  assert.equal(held.name, "");
  assert.equal(held.city, "Albany");
  assert.match(haus, /carrierListHtml\(/);
  assert.match(haus, /pickupForHold\(reserveFlow\.lic, reserveFlow\.city\)/);
  assert.match(haus, /data-holdplace=/);
});

const NIGHTFALL = {
  id: "run-nf",
  name: "No. 4 Nightfall",
  line: "A single source midnight press, cold cured slow. Two hundred and fifty numbered.",
  size: 250,
};

const WAITLIST_CONFIRM =
  "Join the waitlist. We'll let you know when a licensed dispensary near you carries Bond. Nothing is reserved yet.";

function assertNoHoldLanguage(html: string) {
  assert.equal(/\b(held|hold|collect|pickup|ready|reservation)\b/i.test(html), false, html);
}

test("zero carriers render a waitlist and do not promise a hold", () => {
  const haus = read("Haus.dc.html");
  const api = loadCarriers({});
  assert.equal(api.WAITLIST_CONFIRM, WAITLIST_CONFIRM);
  assert.equal(api.bondCarriers().length, 0);

  const closed = api.waitlistRunHtml(NIGHTFALL, "#C08457", false, false);
  const open = api.waitlistRunHtml(NIGHTFALL, "#C08457", true, false);
  const joined = api.waitlistRunHtml(NIGHTFALL, "#C08457", true, true);
  for (const html of [closed, open, joined]) {
    assert.equal(html.includes("The next numbered run"), true);
    assert.equal(html.includes("No. 4 Nightfall"), true);
    assert.equal(html.includes(NIGHTFALL.line), true);
    assert.equal(html.includes("250 numbered . opening soon"), true);
    assertNoHoldLanguage(html);
    assert.equal(html.includes("Reserve your place"), false);
    assert.equal(html.includes("The house will notify you"), false);
    assert.equal(html.includes("Circle"), false);
  }
  assert.equal(closed.includes(">Join the waitlist</button>"), true);
  assert.equal(closed.includes("No shops carrying Bond yet"), false);
  assert.equal(open.includes("No shops carrying Bond yet"), true);
  assert.equal(open.includes(">Join the waitlist</button>"), true);
  assert.equal(open.includes(">Not now</button>"), true);
  assert.equal(open.includes("Your city"), false);
  assert.equal(joined.includes(WAITLIST_CONFIRM), true);
  assert.equal(joined.includes(">Join the waitlist</button>"), false);
  assert.equal(joined.includes("No shops carrying Bond yet"), false);

  assert.equal(api.joinWaitlist("run-nf"), true);
  assert.equal(api.isWaitlisted("run-nf"), true);
  const joinedLive = api.waitlistRunHtml(NIGHTFALL, "#C08457", false, api.isWaitlisted("run-nf"));
  assert.equal(joinedLive.includes(WAITLIST_CONFIRM), true);
  assertNoHoldLanguage(joinedLive);

  assert.match(haus, /if \(!carriersOn\)\{\s*out \+= waitlistRunHtml\(/);
  assert.match(haus, /bondCarriers\(\)\.length \? holdsSection\(m\) : ''/);
  assert.match(haus, /if \(hp\)\{ if \(!bondCarriers\(\)\.length\) return;/);
  assert.match(haus, /data-holdplace=/);
  assert.match(haus, /Hold my place/);
  assert.match(haus, /Find pickup/);
  assert.match(haus, /Your place is held\. The house will notify you\./);
  const joinAt = haus.indexOf("var jw = t.closest('[data-joinwaitlist]')");
  const joinEnd = haus.indexOf("data-waitlistcancel", joinAt);
  const joinHandler = haus.slice(joinAt, joinEnd);
  assert.equal(joinHandler.includes("reserveHold"), false);
  assert.equal(joinHandler.includes("localStorage"), false);
  assert.equal(joinHandler.includes("toast("), false);
  assert.equal(haus.includes("let you know when a licensed dispensary near you carries Bond. Nothing is reserved yet."), true);
});

test("Haus accepts only a future verified carrier", () => {
  const api = loadCarriers({});
  const verified = {
    lic: "VERIFIED-1",
    name: "Verified Shop",
    city: "Albany",
    lat: 42.65,
    lng: -73.75,
    bond: true,
    verified: true,
  };
  const duplicate = { ...verified, name: "Verified Shop copy" };
  const unverified = {
    lic: "OCM-AUR-0101",
    name: "Empire Botanical Co",
    city: "New York",
    lat: 40.71,
    lng: -74,
    bond: true,
  };
  const sample = {
    lic: "SAMPLE-1",
    name: "Sample Dispensary 04",
    city: "Brooklyn",
    addr: "Sample area 04",
    lat: 40.67,
    lng: -73.94,
    bond: true,
    verified: true,
  };
  const noCoords = {
    lic: "VERIFIED-2",
    name: "Missing Coordinates",
    city: "Troy",
    bond: true,
    verified: true,
  };
  api.readVerifiedCarriers = () => [sample, unverified, verified, duplicate, noCoords, finderSamples[0]];
  const rows = api.bondCarriers();
  assert.deepEqual([...rows].map((row) => String(row.name)), ["Verified Shop"]);
  assert.equal(api.isVerifiedCarrier(unverified), false);
  assert.equal(api.isVerifiedCarrier(sample), false);
  assert.equal(api.isVerifiedCarrier(verified), true);
  const picks = "<button data-pickcarrier=\"VERIFIED-1\">Verified Shop . Albany</button>";
  const list = api.carrierListHtml("Albany", 1, picks);
  assert.equal(list.includes("No shops carrying Bond yet"), false);
  assert.equal(list.includes("Verified Shop"), true);
  assert.equal(list.includes("Sample Dispensary"), false);
  const held = api.pickupForHold("VERIFIED-1", "Albany");
  assert.equal(held.name, "Verified Shop");
  assert.equal(held.lic, "VERIFIED-1");
  assert.equal(api.joinWaitlist("run-nf"), false);
  assert.equal(api.isWaitlisted("run-nf"), false);
  const verifiedList = api.carrierListHtml("Albany", 1, picks);
  assert.equal(verifiedList.includes("Held for you at, nearest first"), true);
  const missing = api.pickupForHold("OCM-AUR-0101", "Buffalo");
  assert.equal(missing.lic, "");
  assert.equal(missing.name, "");
  assert.equal(missing.city, "Buffalo");
});

test("Finder sample heading and Product sample directory stay fictional", () => {
  const finder = read("Finder.dc.html");
  assert.equal(finder.includes(">Sample listings (not real stores)</div>"), true);
  assert.equal(finder.includes("Other licensed dispensaries within fifty miles"), false);
  assert.equal(finder.includes("licensed dispensaries"), false);
  assert.equal(finder.includes("licensed shops"), false);
  assert.equal(finder.includes("Also show other sample listings nearby"), true);
  assert.equal(finder.includes("Enter your city to see sample listings within fifty miles. These are not real stores."), true);
  assert.equal(finder.includes("No other sample listings within fifty miles. These are not real stores."), true);
  assert.equal(finder.includes("sample listings within fifty miles of "), true);
  assert.equal(finder.includes("These are not real stores. Distances are approximate, measured from the center of each city."), true);

  const product = read("Product.dc.html");
  assert.equal(product.includes("OCM-AUR"), false);
  assert.equal(/bond:\s*true/.test(product), false);
  for (let n = 1; n <= 32; n += 1) {
    const nn = String(n).padStart(2, "0");
    assert.equal(product.includes(`name:'Sample Dispensary ${nn}'`), true, nn);
    assert.equal(product.includes(`region:'Sample area ${nn}'`), true, nn);
  }
  const flags = product.match(/bond:false/g);
  assert.equal(flags?.length, 32);
  assert.equal(product.includes("isSampleListingName"), true);
  assert.equal(product.includes("OCM-RETAIL"), false);
  for (const invented of ["Verdant", "Highline", "Northstar", "Solace", "Meridian", "Halcyon"]) {
    assert.equal(product.includes(invented), false, invented);
  }
  for (let n = 1; n <= 6; n += 1) {
    const nn = String(n).padStart(2, "0");
    assert.equal(product.includes(`name:'Sample Account ${nn}'`), true, nn);
  }
  assert.equal(product.includes("destination:'Sample Account 01'"), true);
  assert.equal(product.includes("destination:'Sample Account 02'"), true);
});

test("shipped pages have no OCM-AUR outside tests and no bond true flags", () => {
  const files: string[] = [];
  walk(root, files);
  const aur: string[] = [];
  const retail: string[] = [];
  const bondTrue: string[] = [];
  for (const path of files) {
    if (path.endsWith(".test.ts")) continue;
    if (!/\.(html|js|mjs|ts|tsx|json|md|css)$/.test(path)) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes("OCM-AUR")) aur.push(path);
    if (text.includes("OCM-RETAIL")) retail.push(path);
    if (path.endsWith(".html") && /bond:\s*true/.test(text)) bondTrue.push(path);
  }
  assert.deepEqual(aur, []);
  assert.deepEqual(retail, []);
  assert.deepEqual(bondTrue, []);
});
