"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalFrame } from "@/components/portal-frame";
import { WingMosaic } from "@/components/vauxhall/wing-mosaics";
import type { AdminRole } from "@/lib/tokens";
import {
  commandHref,
  COMMAND_SECTIONS,
  WING_CONSOLES,
  parseVauxhallRoute,
  type VauxhallRoute,
} from "@/lib/vauxhall/routes";
import {
  AgentsView,
  EvolutionView,
  KnowledgeView,
  LiveFeedView,
  QueueView,
  ReviewView,
  SteeringView,
} from "./command-views";
import { readLocalPartnerDrafts } from "@/lib/order/persist";
import type { PartnerDraftBundle } from "@/lib/order/types";
import { useVauxhallStore } from "./use-store";

export function CommandApp({
  role,
  email,
  route,
  partnerRequests,
}: {
  role: AdminRole;
  email?: string | null;
  route: VauxhallRoute;
  partnerRequests?: PartnerDraftBundle;
}) {
  const store = useVauxhallStore();
  const router = useRouter();
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (partnerRequests) store.ingestPartnerRequests(partnerRequests);
    store.ingestPartnerRequests(readLocalPartnerDrafts());
  }, [store, partnerRequests]);

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
    if (!store.demoLive) return;
    const timer = window.setInterval(() => {
      store.tickMonitorEngine(2000);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [store, store.demoLive]);

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

  const sections =
    route.wing === "command"
      ? COMMAND_SECTIONS.map((section) => ({
          ...section,
          href: commandHref(section.id),
          badge: section.id === "review" ? store.openReviewCount() : undefined,
        }))
      : WING_CONSOLES[route.wing].map((item) => ({
          id: item.id,
          href: item.href,
          title: item.title,
        }));

  return (
    <PortalFrame
      role={role}
      email={email}
      active={route.wing}
      sections={sections}
      sectionActive={route.view}
    >
      {route.wing === "command" ? (
        <>
          {route.view === "agents" ? <AgentsView store={store} /> : null}
          {route.view === "review" ? <ReviewView store={store} onToast={showToast} /> : null}
          {route.view === "queue" ? <QueueView store={store} /> : null}
          {route.view === "steering" ? <SteeringView store={store} onToast={showToast} /> : null}
          {route.view === "evolution" ? <EvolutionView store={store} onToast={showToast} /> : null}
          {route.view === "knowledge" ? <KnowledgeView store={store} /> : null}
          {route.view === "live-feed" ? <LiveFeedView store={store} onToast={showToast} /> : null}
        </>
      ) : (
        <WingMosaic id={route.wing} consoleId={route.view} role={role} onToast={showToast} />
      )}
      <div className={`vx-toast${toast ? " show" : ""}`}>{toast}</div>
    </PortalFrame>
  );
}
