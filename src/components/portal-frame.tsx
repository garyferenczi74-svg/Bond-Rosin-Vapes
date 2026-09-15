import Link from "next/link";
import { signOutAction } from "@/app/haus/actions";
import type { AdminRole, WingId } from "@/lib/tokens";
import { wings } from "@/lib/tokens";

export type PortalSection = {
  id: string;
  href: string;
  title: string;
  badge?: number;
};

export function PortalFrame({
  role,
  email,
  active,
  children,
  sections,
  sectionActive,
}: {
  role: AdminRole;
  email?: string | null;
  active: WingId;
  children: React.ReactNode;
  sections?: PortalSection[];
  sectionActive?: string;
}) {
  const wing = wings.find((item) => item.id === active);
  const who = email?.split("@")[0] || role;

  return (
    <div className="vx-shell">
      <aside className="vx-rail">
        <div className="vx-brand">
          <div
            className="didot"
            style={{
              fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
              fontWeight: 400,
              fontSize: 18,
              letterSpacing: "0.35em",
              paddingLeft: "0.35em",
            }}
          >
            BOND
          </div>
          <p className="lbl" style={{ margin: "8px 0 0" }}>
            Vauxhall
          </p>
        </div>

        <nav className="vx-rail-nav" aria-label="Wings">
          {wings.map((item) => {
            const on = item.id === active;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`vx-rail-link${on ? " on" : ""}`}
                style={{ ["--wing-ink" as string]: item.hairline }}
              >
                <span className="vx-mark" aria-hidden="true" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="vx-rail-foot">
          <div>
            <div style={{ fontSize: 13, color: "#E1DAD0" }}>{who}</div>
            <p className="lbl" style={{ margin: "4px 0 0" }}>
              {role}
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="vx-act">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="vx-stage">
        <header className="vx-stage-head">
          <div>
            <div
              className="vx-wing-rule"
              style={{ background: wing?.hairline ?? "#E1DAD0" }}
            />
            <h1
              className="didot vx-wing-title"
              style={{
                fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
                fontWeight: 400,
              }}
            >
              {wing?.title ?? "Vauxhall"}
            </h1>
            <p className="vx-wing-sub">{wing?.summary}</p>
          </div>
        </header>

        {sections && sections.length > 0 ? (
          <nav className="vx-tabs" aria-label="Module">
            {sections.map((section) => {
              const on = section.id === sectionActive;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className={`vx-tab${on ? " on" : ""}`}
                >
                  {section.title}
                  {section.badge ? <span className="vx-tab-badge">{section.badge}</span> : null}
                </Link>
              );
            })}
          </nav>
        ) : null}

        <section className="vx-stage-body rise">{children}</section>
      </div>
    </div>
  );
}
