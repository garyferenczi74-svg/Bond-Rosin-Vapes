import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMAND_SECTIONS,
  PRODUCT_CONSOLES,
  SECURITY_CONSOLES,
  SOCIAL_CONSOLES,
  WING_CONSOLES,
  parseVauxhallRoute,
} from "./routes.ts";

test("Command Center module strip leads with Live Feed, Review, Queue", () => {
  assert.deepEqual(
    COMMAND_SECTIONS.slice(0, 3).map((section) => section.id),
    ["live-feed", "review", "queue"],
  );
  assert.deepEqual(
    COMMAND_SECTIONS.slice(0, 3).map((section) => section.title),
    ["Live Feed", "Review", "Queue"],
  );
});

test("command views parse from app router slugs", () => {
  assert.deepEqual(parseVauxhallRoute([]), { wing: "command", view: "live-feed", path: "/vauxhall" });
  assert.equal(parseVauxhallRoute(["live-feed"])?.view, "live-feed");
  assert.equal(parseVauxhallRoute(["review"])?.view, "review");
  assert.equal(parseVauxhallRoute(["knowledge"])?.path, "/vauxhall/knowledge");
  assert.equal(parseVauxhallRoute(["review", "extra"]), null);
});

test("Product landing is SKU Portfolio", () => {
  assert.equal(PRODUCT_CONSOLES[0]?.id, "sku-portfolio");
  assert.equal(PRODUCT_CONSOLES[0]?.href, "/vauxhall/product");
  assert.equal(PRODUCT_CONSOLES.some((item) => item.id === "dashboard"), true);
});

test("wing consoles parse and unknown slugs stay cloaked", () => {
  assert.deepEqual(parseVauxhallRoute(["product"]), {
    wing: "product",
    view: "sku-portfolio",
    path: "/vauxhall/product",
  });
  assert.equal(parseVauxhallRoute(["product", "sku-portfolio"])?.view, "sku-portfolio");
  assert.equal(parseVauxhallRoute(["product", "dashboard"])?.path, "/vauxhall/product/dashboard");
  assert.equal(parseVauxhallRoute(["security", "pre-check"])?.view, "pre-check");
  assert.equal(parseVauxhallRoute(["social", "scheduler"])?.path, "/vauxhall/social/scheduler");
  assert.equal(parseVauxhallRoute(["admin"]), null);
  assert.equal(parseVauxhallRoute(["product", "missing"]), null);
});

test("every sidebar console parses and unknown slugs stay cloaked", () => {
  for (const [wing, consoles] of Object.entries(WING_CONSOLES)) {
    for (const item of consoles) {
      const slug = item.href.replace("/vauxhall/", "").split("/").filter(Boolean);
      const parsed = parseVauxhallRoute(slug);
      assert.ok(parsed, item.href);
      assert.equal(parsed?.wing, wing);
      assert.equal(parsed?.view, item.id);
    }
  }
  assert.equal(SECURITY_CONSOLES.some((item) => item.id === "pre-check"), true);
  assert.equal(SOCIAL_CONSOLES.some((item) => item.id === "scheduler"), true);
  assert.equal(parseVauxhallRoute(["security", "unknown"]), null);
  assert.equal(parseVauxhallRoute(["social", "publish"]), null);
});
