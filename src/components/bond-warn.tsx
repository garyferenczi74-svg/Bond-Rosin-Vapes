import {
  HOPE_LEAD,
  HOPE_MID,
  HOPE_PHONE_HREF,
  HOPE_PHONE_LABEL,
  HOPE_TAIL,
  HOPE_URL,
  HOPE_URL_LABEL,
  LICENSE_LINE,
  WARNING_C1,
  dLineForRoute,
  type WarningRoute,
} from "@/lib/bond-warnings";

export function BondWarn({ route }: { route: WarningRoute }) {
  return (
    <div className="bond-warn">
      <div className="bond-warn-box">
        <p>{WARNING_C1}</p>
        <p>{dLineForRoute(route)}</p>
      </div>
      <p className="bond-warn-hope">
        {HOPE_LEAD}
        <a href={HOPE_PHONE_HREF}>{HOPE_PHONE_LABEL}</a>
        {HOPE_MID}
        <a href={HOPE_URL}>{HOPE_URL_LABEL}</a>
        {HOPE_TAIL}
      </p>
      <p className="bond-warn-license">{LICENSE_LINE}</p>
    </div>
  );
}
