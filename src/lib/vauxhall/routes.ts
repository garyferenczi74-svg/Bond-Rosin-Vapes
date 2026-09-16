import type { WingId } from "@/lib/tokens";

export const COMMAND_VIEWS = [
  "live-feed",
  "agents",
  "review",
  "queue",
  "steering",
  "evolution",
  "knowledge",
] as const;

export type CommandView = (typeof COMMAND_VIEWS)[number];

export type ConsoleItem = {
  id: string;
  title: string;
  href: string;
};

export const PRODUCT_CONSOLES: ConsoleItem[] = [
  { id: "sku-portfolio", title: "SKU Portfolio", href: "/vauxhall/product" },
  { id: "dashboard", title: "Dashboard", href: "/vauxhall/product/dashboard" },
  { id: "board-metrics", title: "Board Metrics", href: "/vauxhall/product/board-metrics" },
  { id: "unit-economics", title: "Unit Economics", href: "/vauxhall/product/unit-economics" },
  { id: "alerts-and-risks", title: "Alerts and Risks", href: "/vauxhall/product/alerts-and-risks" },
  { id: "inventory", title: "Inventory", href: "/vauxhall/product/inventory" },
  { id: "production", title: "Production", href: "/vauxhall/product/production" },
  { id: "orders", title: "Orders", href: "/vauxhall/product/orders" },
  { id: "accounts", title: "Accounts", href: "/vauxhall/product/accounts" },
  { id: "trace", title: "Trace", href: "/vauxhall/product/trace" },
];

export const SECURITY_CONSOLES: ConsoleItem[] = [
  { id: "findings", title: "Findings", href: "/vauxhall/security" },
  { id: "incidents", title: "Incidents", href: "/vauxhall/security/incidents" },
  { id: "rules", title: "Rules", href: "/vauxhall/security/rules" },
  { id: "waivers", title: "Waivers", href: "/vauxhall/security/waivers" },
  { id: "audit-log", title: "Audit Log", href: "/vauxhall/security/audit-log" },
  { id: "dsar", title: "DSAR", href: "/vauxhall/security/dsar" },
  { id: "vendors", title: "Vendors", href: "/vauxhall/security/vendors" },
  { id: "dashboards", title: "Dashboards", href: "/vauxhall/security/dashboards" },
  { id: "scanner-bridge", title: "Scanner Bridge", href: "/vauxhall/security/scanner-bridge" },
  { id: "pre-check", title: "Pre-Check", href: "/vauxhall/security/pre-check" },
  { id: "soc-2-exporter", title: "SOC 2 Exporter", href: "/vauxhall/security/soc-2-exporter" },
];

export const SOCIAL_CONSOLES: ConsoleItem[] = [
  { id: "overview", title: "Overview", href: "/vauxhall/social" },
  { id: "content", title: "Content", href: "/vauxhall/social/content" },
  { id: "create", title: "Create", href: "/vauxhall/social/create" },
  { id: "auto-script", title: "Auto-Script", href: "/vauxhall/social/auto-script" },
  { id: "research", title: "Research", href: "/vauxhall/social/research" },
  { id: "scriptwriter", title: "Scriptwriter", href: "/vauxhall/social/scriptwriter" },
  { id: "editor", title: "Editor", href: "/vauxhall/social/editor" },
  { id: "scheduler", title: "Scheduler", href: "/vauxhall/social/scheduler" },
  { id: "analyzer", title: "Analyzer", href: "/vauxhall/social/analyzer" },
  { id: "post-tracking", title: "Post Tracking", href: "/vauxhall/social/post-tracking" },
];

export const WING_CONSOLES: Record<Exclude<WingId, "command">, ConsoleItem[]> = {
  product: PRODUCT_CONSOLES,
  security: SECURITY_CONSOLES,
  social: SOCIAL_CONSOLES,
};

export const COMMAND_SECTIONS: { id: CommandView; href: string; title: string }[] = [
  { id: "live-feed", href: "/vauxhall/live-feed", title: "Live Feed" },
  { id: "review", href: "/vauxhall/review", title: "Review" },
  { id: "queue", href: "/vauxhall/queue", title: "Queue" },
  { id: "agents", href: "/vauxhall/agents", title: "Agents" },
  { id: "steering", href: "/vauxhall/steering", title: "Steering" },
  { id: "evolution", href: "/vauxhall/evolution", title: "Evolution" },
  { id: "knowledge", href: "/vauxhall/knowledge", title: "Knowledge" },
];

export const COMMAND_PRIMARY_TABS = ["live-feed", "review", "queue"] as const;

export type VauxhallRoute =
  | { wing: "command"; view: CommandView; path: string }
  | { wing: Exclude<WingId, "command">; view: string; path: string };

const COMMAND_SET = new Set<string>(COMMAND_VIEWS);
const WING_SET = new Set(["product", "security", "social"]);

function defaultConsole(wing: Exclude<WingId, "command">): string {
  if (wing === "product") return "sku-portfolio";
  return WING_CONSOLES[wing][0]?.id ?? "dashboard";
}

function isWingConsole(wing: Exclude<WingId, "command">, id: string): boolean {
  return WING_CONSOLES[wing].some((item) => item.id === id);
}

export function parseVauxhallRoute(slug?: string[]): VauxhallRoute | null {
  const parts = slug ?? [];
  if (parts.length === 0) {
    return { wing: "command", view: "live-feed", path: "/vauxhall" };
  }

  const head = parts[0] ?? "";
  if (head === "live-feed" || COMMAND_SET.has(head)) {
    if (parts.length > 1) return null;
    const view = (head === "live-feed" ? "live-feed" : head) as CommandView;
    if (!COMMAND_SET.has(view)) return null;
    return { wing: "command", view, path: `/vauxhall/${view}` };
  }

  if (WING_SET.has(head)) {
    const wing = head as Exclude<WingId, "command">;
    if (parts.length === 1) {
      return { wing, view: defaultConsole(wing), path: `/vauxhall/${wing}` };
    }
    if (parts.length === 2 && isWingConsole(wing, parts[1] ?? "")) {
      return { wing, view: parts[1] ?? defaultConsole(wing), path: `/vauxhall/${wing}/${parts[1]}` };
    }
    return null;
  }

  return null;
}

export function commandHref(view: CommandView): string {
  return view === "live-feed" ? "/vauxhall" : `/vauxhall/${view}`;
}
