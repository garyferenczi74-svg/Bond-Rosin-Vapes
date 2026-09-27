// Same session key as AgeGate.dc.html. A stored value means the visitor already entered.

export const BOND_AGE_KEY = "bond_age_ok";

export const HAUS_AGE_HOST = "/haus-age-host.dc.html";

export const HAUS_DOOR_PATH = "/haus";

export function hausShowsAgeGate(stored: string | null): boolean {
  return stored == null || stored === "";
}

export function hausRouteShowsAgeGate(pathname: string, stored: string | null): boolean {
  if (pathname !== HAUS_DOOR_PATH && !pathname.startsWith(`${HAUS_DOOR_PATH}/`)) return false;
  return hausShowsAgeGate(stored);
}

export const HAUS_AGE_BOOT = `(function(){var stored=null;try{stored=sessionStorage.getItem(${JSON.stringify(BOND_AGE_KEY)});}catch(e){}if(stored==null||stored===""){document.documentElement.removeAttribute("data-bond-age");}else{document.documentElement.setAttribute("data-bond-age","ok");}})();`;

export const HAUS_AGE_CSS = `
html:not([data-bond-age="ok"]) .haus-floor-slot { visibility: hidden; }
.haus-age-frame {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  z-index: 9999;
  background: var(--matte-black);
}
`.trim();
