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

const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

export const AGE_GATE_CRITICAL = `/* Cover paints before tokens arrive */
#bond-gate-cover{position:fixed;inset:0;z-index:8000;background:#1B1D1C;pointer-events:auto}
html,body{background:var(--matte-black);margin:0;color:var(--bone)}
:root{--font-didot:"GFS Didot"}
html[data-bond-age="ok"] #bond-gate-cover{display:none}
html:not([data-bond-age="ok"]) .bond-floor { visibility: hidden; }
html[data-bond-age="ok"] .bond-age-gate { display: none; }
.bond-age-gate{position:fixed;inset:0;z-index:9999;background:#0D0F0E;display:flex;flex-direction:column;align-items:center}
.bond-age-gate .bond-age-ask .bond-age-body{font-family:Arial,"Segoe UI",sans-serif;font-size:16px;line-height:1.7;font-weight:400;color:#B0A99A;max-width:440px;margin:26px auto}
.bond-age-gate .bond-age-panel .bond-age-mark,.bond-age-gate .bond-age-panel .bond-age-lead,.bond-age-gate .bond-age-panel .bond-age-title{font-family:Georgia,"Times New Roman",serif;font-weight:400}`;

function webFace(family: string, weight: string, file: string): string {
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url("${file}") format("woff2");unicode-range:${LATIN_RANGE}}`;
}

export const HAUS_FONT_LATE_CSS = [
  webFace("Inter", "400", "/fonts/inter-latin.woff2"),
  webFace("Inter", "500", "/fonts/inter-latin.woff2"),
  webFace("GFS Didot", "400", "/fonts/gfs-didot-latin-400.woff2"),
  `html body .bond-age-gate .bond-age-ask .bond-age-body{font-family:Inter,"Inter Fallback",Aptos,"Segoe UI Variable","Segoe UI",sans-serif}`,
  `html body .bond-age-gate .bond-age-panel .bond-age-mark,html body .bond-age-gate .bond-age-panel .bond-age-lead,html body .bond-age-gate .bond-age-panel .bond-age-title{font-family:"GFS Didot","Didot Fallback",Didot,serif}`,
].join("");

export const HAUS_FONT_LATE = `(function(){function load(){if(document.getElementById("bond-gate-fonts"))return;var cover=document.getElementById("bond-gate-cover");var gate=document.querySelector(".bond-age-gate");if(cover==null&&gate==null)return;var node=document.createElement("style");node.id="bond-gate-fonts";node.textContent=${JSON.stringify(HAUS_FONT_LATE_CSS)};var parent=document.body;if(parent==null)parent=document.documentElement;parent.appendChild(node);}function arm(){requestAnimationFrame(function(){requestAnimationFrame(load);});}window.addEventListener("load",arm);})();`;
