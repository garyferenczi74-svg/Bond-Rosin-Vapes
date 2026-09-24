"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BOND_AGE_KEY, HAUS_AGE_HOST, hausShowsAgeGate } from "@/lib/haus/age-gate";

function readStoredAge(): string | null {
  try {
    return sessionStorage.getItem(BOND_AGE_KEY);
  } catch (e) {
    return null;
  }
}

export function HausAgeGate({ children }: { children: ReactNode }) {
  const [showGate, setShowGate] = useState<boolean | null>(null);

  useEffect(() => {
    let timer = 0;
    const apply = (show: boolean) => {
      if (show) document.documentElement.removeAttribute("data-bond-age");
      else {
        document.documentElement.setAttribute("data-bond-age", "ok");
        if (timer) window.clearInterval(timer);
      }
      setShowGate(show);
    };
    const showNow = hausShowsAgeGate(readStoredAge());
    apply(showNow);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if ((data as { type?: unknown }).type !== "bond-entered") return;
      apply(false);
    };
    window.addEventListener("message", onMessage);
    if (showNow) {
      timer = window.setInterval(() => {
        if (!hausShowsAgeGate(readStoredAge())) apply(false);
      }, 400);
    }
    return () => {
      window.removeEventListener("message", onMessage);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      {showGate ? (
        <iframe className="haus-age-frame" title="Age gate" src={HAUS_AGE_HOST} />
      ) : null}
      <div className="haus-floor-slot" inert={showGate !== false ? true : undefined}>
        {children}
      </div>
    </>
  );
}
