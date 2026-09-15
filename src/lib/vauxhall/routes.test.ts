import assert from "node:assert/strict";
import test from "node:test";
import { COMMAND_SECTIONS, parseVauxhallRoute } from "./routes.ts";

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

test("wing consoles parse and unknown slugs stay cloaked", () => {
  assert.deepEqual(parseVauxhallRoute(["product"]), {
    wing: "product",
    view: "dashboard",
    path: "/vauxhall/product",
  });
  assert.equal(parseVauxhallRoute(["security", "pre-check"])?.view, "pre-check");
  assert.equal(parseVauxhallRoute(["social", "scheduler"])?.path, "/vauxhall/social/scheduler");
  assert.equal(parseVauxhallRoute(["admin"]), null);
  assert.equal(parseVauxhallRoute(["product", "missing"]), null);
});
