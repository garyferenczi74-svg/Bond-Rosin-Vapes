// Same session key as AgeGate.dc.html. A stored value means the visitor already entered.

export const BOND_AGE_KEY = "bond_age_ok";

export const HAUS_DOOR_PATH = "/haus";

export function hausShowsAgeGate(stored: string | null): boolean {
  return stored == null || stored === "";
}

export const BOND_AGE_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function bondBirthYears(now: Date): string[] {
  const end = now.getFullYear();
  const years: string[] = [];
  for (let y = end; y >= end - 100; y--) years.push(String(y));
  return years;
}

// Same month index and birth-on-the-first rule as AgeGate.dc.html.
export function bondAgeDecision(month: string, year: string, now: Date): "wait" | "enter" | "decline" {
  if (month === "" || year === "") return "wait";
  const born = new Date(parseInt(year, 10), parseInt(month, 10), 1);
  let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth()) age = age - 1;
  if (age >= 21) return "enter";
  return "decline";
}

export function hausRouteShowsAgeGate(pathname: string, stored: string | null): boolean {
  if (pathname !== HAUS_DOOR_PATH && !pathname.startsWith(`${HAUS_DOOR_PATH}/`)) return false;
  return hausShowsAgeGate(stored);
}

const PUBLIC_AGE_EXACT = new Set(["/faq", "/privacy", "/terms", "/order", "/haus"]);

export function routeShowsAgeGate(pathname: string, stored: string | null): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (path.startsWith("/vauxhall")) return false;
  const covered = PUBLIC_AGE_EXACT.has(path) || path.startsWith(`${HAUS_DOOR_PATH}/`);
  if (!covered) return false;
  return hausShowsAgeGate(stored);
}

export const HAUS_AGE_BOOT = `(function(){var stored=null;try{stored=sessionStorage.getItem(${JSON.stringify(BOND_AGE_KEY)});}catch(e){}if(stored==null||stored===""){document.documentElement.removeAttribute("data-bond-age");}else{document.documentElement.setAttribute("data-bond-age","ok");}})();`;

export const AGE_GATE_CRITICAL = `html:not([data-bond-age="ok"]) .bond-floor { visibility: hidden; }
html[data-bond-age="ok"] .bond-age-gate { display: none; }`;
