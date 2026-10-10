"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BondWarn } from "@/components/bond-warn";
import type { WarningRoute } from "@/lib/bond-warnings";
import {
  BOND_AGE_KEY,
  bondAgeStamp,
  bondAgeTimestamp,
  markBondAgePassed,
} from "@/lib/haus/age-gate";

const CONSENT = "By entering you confirm you are 21 or older and consent to view cannabis-related material.";
const REMEMBER = "We remember your answer on this device for 30 days.";
const FULL_WARN =
  "For use only by persons 21 years of age and older. Keep out of reach of children and pets. If someone accidentally consumes cannabis, contact the Poison Center. Consume responsibly.";
const DENIED =
  "You must be 21 or older to visit this site. If you or someone you know needs support, the NYS HOPEline is confidential: call 1-877-8-HOPENY or text HOPENY (467369).";
const DENIED_PHONE = "1-877-8-HOPENY";
const [DENIED_LEAD, DENIED_TAIL] = DENIED.split(DENIED_PHONE);

function readRaw(store: Storage): string | null {
  try {
    return store.getItem(BOND_AGE_KEY);
  } catch {
    return null;
  }
}

function drop(store: Storage) {
  try {
    store.removeItem(BOND_AGE_KEY);
  } catch {
    /* private mode */
  }
}

function controlsIn(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea")).filter((el) => {
    if ((el as HTMLButtonElement).disabled) return false;
    if (el.tabIndex < 0) return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  });
}

export function BondAgeGate({ route, children }: { route: WarningRoute; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  const gateRef = useRef<HTMLDivElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const deniedRef = useRef<HTMLHeadingElement>(null);
  const pressedYes = useRef(false);

  useEffect(() => {
    const now = Date.now();
    const localRaw = readRaw(localStorage);
    const sessionRaw = readRaw(sessionStorage);
    if (sessionRaw != null) drop(sessionStorage);
    const localHit = bondAgeTimestamp(localRaw, now);
    if (localHit != null) {
      markBondAgePassed(document.documentElement);
      setOpen(true);
      try {
        window.dispatchEvent(new CustomEvent("bond-entered"));
      } catch {
        /* ignore */
      }
      return;
    }
    if (localRaw) drop(localStorage);
    let tries = 0;
    let id = 0;
    const focusYes = () => {
      yesRef.current?.focus({ preventScroll: true });
      tries += 1;
      if (document.activeElement === yesRef.current || tries >= 20) return;
      id = window.setTimeout(focusYes, 60);
    };
    id = window.setTimeout(focusYes, 60);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (open) return;
    function onTab(ev: KeyboardEvent) {
      if (ev.key !== "Tab") return;
      const controls = controlsIn(gateRef.current);
      if (!controls.length) {
        ev.preventDefault();
        return;
      }
      const idx = controls.indexOf(document.activeElement as HTMLElement);
      const next =
        idx === -1
          ? ev.shiftKey
            ? controls.length - 1
            : 0
          : ev.shiftKey
            ? idx === 0
              ? controls.length - 1
              : idx - 1
            : idx === controls.length - 1
              ? 0
              : idx + 1;
      ev.preventDefault();
      controls[next].focus();
    }
    function onFocusIn(ev: FocusEvent) {
      const gate = gateRef.current;
      const target = ev.target as Node | null;
      if (!target || target === document.body || target === document.documentElement) return;
      if (gate && (target === gate || gate.contains(target))) return;
      const controls = controlsIn(gate);
      if (controls.length && document.activeElement !== controls[0]) controls[0].focus();
    }
    document.addEventListener("keydown", onTab, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onTab, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [open]);

  useEffect(() => {
    if (declined) deniedRef.current?.focus();
  }, [declined]);

  useEffect(() => {
    if (!open || !pressedYes.current) return;
    pressedYes.current = false;
    let tries = 0;
    let id = 0;
    const attempt = () => {
      const gate = document.getElementById("bond-age-gate");
      const outside = (el: Element | null): el is HTMLElement =>
        el instanceof HTMLElement && !(gate && gate.contains(el));
      const main = document.querySelector("main");
      let target: HTMLElement | null = outside(main) ? main : null;
      if (!target) {
        for (const node of document.querySelectorAll("h1, h2")) {
          if (outside(node)) {
            target = node;
            break;
          }
        }
      }
      if (target) {
        if (target.tabIndex < 0) target.setAttribute("tabindex", "-1");
        if (!target.hasAttribute("data-bond-age-target")) {
          target.setAttribute("data-bond-age-target", "");
          target.addEventListener(
            "blur",
            () => {
              target.removeAttribute("data-bond-age-target");
            },
            { once: true },
          );
        }
        target.focus({ preventScroll: true });
        if (document.activeElement === target) return;
      }
      tries += 1;
      if (tries >= 160) return;
      id = window.setTimeout(attempt, 50);
    };
    attempt();
    return () => window.clearTimeout(id);
  }, [open]);

  function yes() {
    const t = Date.now();
    try {
      localStorage.setItem(BOND_AGE_KEY, bondAgeStamp(t));
    } catch {
      /* private mode */
    }
    try {
      sessionStorage.setItem(BOND_AGE_KEY, String(t));
    } catch {
      /* private mode */
    }
    markBondAgePassed(document.documentElement);
    pressedYes.current = true;
    setOpen(true);
    try {
      window.dispatchEvent(new CustomEvent("bond-entered"));
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div
        id="bond-age-gate"
        ref={gateRef}
        className="bond-age-gate"
        data-declined={declined ? "true" : "false"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={declined ? "bond-gate-denied-h" : "bond-gate-h"}
      >
        <div className="bond-age-box">
          <p className="bond-age-logo">BOND</p>
          <div className="bond-age-panel bond-age-ask">
            <h2 id="bond-gate-h" className="bond-age-lead">
              Are you 21 or older?
            </h2>
            <p className="bond-age-body">Bond is a cannabis product for adults 21 and older.</p>
            <div className="bond-age-actions">
              <button type="button" id="bond-age-yes" ref={yesRef} className="bond-age-yes" onClick={yes}>
                Yes, I am 21 or older
              </button>
              <button type="button" id="bond-age-no" className="bond-age-no-btn" onClick={() => setDeclined(true)}>
                No
              </button>
            </div>
            <p className="bond-age-legal">
              {CONSENT} {REMEMBER} {FULL_WARN}
            </p>
          </div>
          <div className="bond-age-panel bond-age-no">
            <h2 id="bond-gate-denied-h" ref={deniedRef} className="bond-age-title" tabIndex={-1}>
              Come back when you&apos;re 21.
            </h2>
            <p className="bond-age-body">
              {DENIED_LEAD}
              <span className="bond-age-tel">{DENIED_PHONE}</span>
              {DENIED_TAIL}
            </p>
          </div>
          <BondWarn route={route} holdLicense />
        </div>
      </div>
      <div className="bond-floor" inert={open ? undefined : true}>
        {children}
      </div>
    </>
  );
}
