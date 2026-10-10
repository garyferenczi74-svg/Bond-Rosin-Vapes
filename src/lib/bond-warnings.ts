// One source for the 129.2 warning strings and the route assignment.
// (c)(1) is on every route. Exactly one (d) line is assigned per route.

export const WARNING_C1 =
  "For use only by persons 21 years of age and older. Keep out of reach of children and pets. If someone accidentally consumes cannabis, contact the Poison Center. Consume responsibly.";

export const D_LINES = [
  "Cannabis can be addictive.",
  "Cannabis can impair concentration and coordination. Do not operate a vehicle or machinery under the influence of cannabis.",
  "There may be health risks associated with consumption of this product.",
  "Cannabis is not recommended for use by persons who are pregnant or nursing.",
] as const;

export const HOPE_LEAD =
  "Concerned about your cannabis use? Contact the New York State HOPEline by texting HOPENY (467369), calling ";
export const HOPE_PHONE_HREF = "tel:18778467369";
export const HOPE_PHONE_LABEL = "1-877-8-HOPENY";
export const HOPE_MID = ", or visiting ";
export const HOPE_URL = "https://oasas.ny.gov/hopeline";
export const HOPE_URL_LABEL = "oasas.ny.gov/hopeline";
export const HOPE_TAIL = ".";

export const LICENSE_LEAD =
  "Cedargrowth LLC. Licensed by the New York State Office of Cannabis Management. ";
export const LICENSE_NUMBER = "OCM-PROC-25-000329";
export const LICENSE_LINE = LICENSE_LEAD + LICENSE_NUMBER;

export const WARNING_ROUTES = [
  { route: "/", label: "/", file: "Home.dc.html", gate: "import", d: 1 },
  { route: "/no1", label: "No1", file: "No1.dc.html", gate: "import", d: 2 },
  { route: "/no2", label: "No2", file: "No2.dc.html", gate: "import", d: 3 },
  { route: "/no3", label: "No3", file: "No3.dc.html", gate: "import", d: 4 },
  { route: "/finder", label: "/finder", file: "Finder.dc.html", gate: "inline", d: 1 },
  { route: "/faq", label: "/faq", file: "FAQ.dc.html", gate: "inline", d: 2 },
  { route: "/privacy", label: "/privacy", file: "Privacy.dc.html", gate: "inline", d: 3 },
  { route: "/terms", label: "/terms", file: "Terms.dc.html", gate: "inline", d: 4 },
  { route: "/order", label: "/order", file: "", gate: "react", d: 1 },
  { route: "/haus", label: "/haus", file: "", gate: "react", d: 2 },
  { route: "/haus/welcome", label: "/haus/welcome", file: "", gate: "react", d: 3 },
  { route: "/haus/floor", label: "Haus member floor", file: "Haus.dc.html", gate: "none", d: 4 },
] as const;

export type WarningRoute = (typeof WARNING_ROUTES)[number]["route"];

export function dLineForSlot(slot: number): string {
  const index = slot - 1;
  return D_LINES[index] ?? D_LINES[0];
}

export function dLineForRoute(route: WarningRoute): string {
  const row = WARNING_ROUTES.find((item) => item.route === route);
  return dLineForSlot(row ? row.d : 1);
}

export function warningRouteForPath(pathname: string): WarningRoute {
  const trimmed = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  const path = trimmed.toLowerCase();
  if (path === "" || path === "/" || path === "/home" || path === "/home.dc.html") return "/";
  if (path === "/no1" || path === "/no-1" || path === "/no1.dc.html") return "/no1";
  if (path === "/no2" || path === "/no-2" || path === "/no2.dc.html") return "/no2";
  if (path === "/no3" || path === "/no-3" || path === "/no3.dc.html") return "/no3";
  if (path === "/finder" || path === "/finder.dc.html") return "/finder";
  if (path === "/faq" || path === "/faq.dc.html") return "/faq";
  if (path === "/privacy" || path === "/privacy.dc.html") return "/privacy";
  if (path === "/terms" || path === "/terms.dc.html") return "/terms";
  if (path === "/order") return "/order";
  if (path === "/haus") return "/haus";
  if (path === "/haus/welcome") return "/haus/welcome";
  if (path.startsWith("/haus/")) return "/haus/floor";
  return "/";
}

export function warnBlockHtml(line: string): string {
  return (
    '<div class="bond-warn">' +
    '<div class="bond-warn-box">' +
    `<p>${WARNING_C1}</p>` +
    `<p>${line}</p>` +
    "</div>" +
    `<p class="bond-warn-hope">${HOPE_LEAD}<a href="${HOPE_PHONE_HREF}">${HOPE_PHONE_LABEL}</a>${HOPE_MID}<a href="${HOPE_URL}">${HOPE_URL_LABEL}</a>${HOPE_TAIL}</p>` +
    `<p class="bond-warn-license">${LICENSE_LINE}</p>` +
    "</div>"
  );
}

export function footerWarnBlockHtml(line: string): string {
  return warnBlockHtml(line).replace(
    `<p class="bond-warn-license">${LICENSE_LINE}</p>`,
    `<p class="bond-warn-license">${LICENSE_LEAD}<span class="bond-warn-lic-no">${LICENSE_NUMBER}</span></p>`,
  );
}

export function warnBlockForRoute(route: WarningRoute): string {
  return warnBlockHtml(dLineForRoute(route));
}
