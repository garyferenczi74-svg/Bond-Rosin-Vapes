"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalFrame } from "@/components/portal-frame";
import { WingStub } from "@/components/wing-stub";
import type { AdminRole } from "@/lib/tokens";
import { commandHref, COMMAND_SECTIONS, parseVauxhallRoute, type VauxhallRoute } from "@/lib/vauxhall/routes";
import {
  AgentsView,
  EvolutionView,
  KnowledgeView,
  LiveFeedView,
  QueueView,
  ReviewView,
  SteeringView,
} from "./command-views";
import { useVauxhallStore } from "./use-store";

export function CommandApp({ role, route }: { role: AdminRole; route: VauxhallRoute }) {
  const store = useVauxhallStore();
  const router = useRouter();
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!store.live) return;
    let cancelled = false;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        store.addEvent(store.genEvent());
        schedule();
      }, 25000 + Math.random() * 20000);
    };
    schedule();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [store, store.live]);

  useEffect(() => {
    function syncHash() {
      const raw = window.location.hash.replace(/^#\/?/, "");
      if (!raw) return;
      const parts = raw.split("/").filter(Boolean);
      const mapped = parts[0] === "vauxhall" ? parts.slice(1) : parts;
      const next = parseVauxhallRoute(mapped.length ? mapped : []);
      if (!next || next.path === route.path) return;
      router.replace(next.path);
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [route.path, router]);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2500);
  }

  const sections = COMMAND_SECTIONS.map((section) => ({
    ...section,
    href: commandHref(section.id),
    badge: section.id === "review" ? store.openReviewCount() : undefined,
  }));

  return (
    <PortalFrame
      role={role}
      active={route.wing}
      sections={route.wing === "command" ? sections : undefined}
      sectionActive={route.wing === "command" ? route.view : undefined}
    >
      {route.wing === "command" ? (
        <div>
          <div style={{ height: 1, background: "#E1DAD0", width: 72, margin: "0 0 22px" }} />
          <h1
            className="didot"
            style={{
              fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
              fontWeight: 400,
              fontSize: "clamp(28px, 4vw, 40px)",
              letterSpacing: "0.02em",
              margin: "0 0 22px",
            }}
          >
            Command Center
          </h1>
          {route.view === "agents" ? <AgentsView store={store} /> : null}
          {route.view === "review" ? <ReviewView store={store} onToast={showToast} /> : null}
          {route.view === "queue" ? <QueueView store={store} /> : null}
          {route.view === "steering" ? <SteeringView store={store} onToast={showToast} /> : null}
          {route.view === "evolution" ? <EvolutionView store={store} onToast={showToast} /> : null}
          {route.view === "knowledge" ? <KnowledgeView store={store} /> : null}
          {route.view === "live-feed" ? <LiveFeedView store={store} onToast={showToast} /> : null}
        </div>
      ) : (
        <WingStub id={route.wing} consoleId={route.view} />
      )}
      <div className={`vx-toast${toast ? " show" : ""}`}>{toast}</div>
    </PortalFrame>
  );
}
