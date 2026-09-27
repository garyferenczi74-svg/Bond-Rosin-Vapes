"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  BOND_AGE_KEY,
  BOND_AGE_MONTHS,
  bondAgeDecision,
  bondBirthYears,
  hausShowsAgeGate,
} from "@/lib/haus/age-gate";

function readStoredAge(): string | null {
  try {
    return sessionStorage.getItem(BOND_AGE_KEY);
  } catch (e) {
    return null;
  }
}

export function BondAgeGate({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [years] = useState(() => bondBirthYears(new Date()));

  useEffect(() => {
    try {
      localStorage.removeItem(BOND_AGE_KEY);
    } catch (e) {}
    if (!hausShowsAgeGate(readStoredAge())) {
      document.documentElement.setAttribute("data-bond-age", "ok");
      setOpen(true);
    }
  }, []);

  function enter() {
    const decision = bondAgeDecision(month, year, new Date());
    if (decision === "wait") return;
    if (decision === "decline") {
      setDeclined(true);
      return;
    }
    try {
      sessionStorage.setItem(BOND_AGE_KEY, String(Date.now()));
    } catch (e) {}
    document.documentElement.setAttribute("data-bond-age", "ok");
    setOpen(true);
    try {
      window.dispatchEvent(new CustomEvent("bond-entered"));
    } catch (e) {}
  }

  const ready = month !== "" && year !== "";

  return (
    <>
      <div id="bond-age-gate" className="bond-age-gate" data-declined={declined ? "true" : "false"}>
        <div className="bond-age-veil"></div>
        <div className="bond-age-veil-soft"></div>
        <div className="bond-age-panel bond-age-no">
          <div className="bond-age-mark">BOND</div>
          <p className="bond-age-title">Not yet</p>
          <p className="bond-age-body">Bond is for adults 21 and over. We look forward to meeting you when it is time.</p>
          <div className="bond-age-rule"></div>
        </div>
        <div className="bond-age-panel bond-age-ask">
          <div className="bond-age-mark">BOND</div>
          <p className="bond-age-lead">Please confirm your age.</p>
          <div className="bond-age-rule bond-age-rule-wide"></div>
          <p className="bond-age-body">By entering, you verify that you are 21 years of age or older and consent to view cannabis-related material.</p>
          <div className="bond-age-fields">
            <select
              id="bond-age-month"
              className="bond-age-select bond-age-month"
              aria-label="Birth month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              <option value="">Birth month</option>
              {BOND_AGE_MONTHS.map((name, index) => (
                <option key={name} value={String(index)}>
                  {name}
                </option>
              ))}
            </select>
            <select
              id="bond-age-year"
              className="bond-age-select bond-age-year"
              aria-label="Birth year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">Birth year</option>
              {years.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <button type="button" id="bond-age-enter" className="bond-age-enter" data-ready={ready ? "true" : "false"} onClick={enter}>
            Enter
          </button>
          <div className="bond-age-health">
            <div className="bond-age-health-label">Health and Safety</div>
            <p>For use only by persons 21 years of age and older. Keep out of reach of children and pets. If someone accidentally consumes cannabis, contact the Poison Center. Consume responsibly.</p>
          </div>
        </div>
      </div>
      <div className="bond-floor" inert={open ? undefined : true}>
        {children}
      </div>
    </>
  );
}
