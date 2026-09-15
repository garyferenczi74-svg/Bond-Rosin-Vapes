"use client";

import { useState } from "react";
import { GENERIC_DOOR } from "@/lib/access";
import { DEMO_OWNER_EMAIL, type VauxhallStore } from "@/lib/vauxhall/store";

export function SignInMock({
  store,
  onRestored,
}: {
  store: VauxhallStore;
  onRestored: () => void;
}) {
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [message, setMessage] = useState("");

  function onCredentials(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    if (store.acceptDemoCredentials(email, password)) {
      setMessage("");
      setStep("mfa");
      return;
    }
    setMessage(GENERIC_DOOR);
  }

  function onMfa(formData: FormData) {
    const code = String(formData.get("code") ?? "");
    if (store.acceptDemoMfa(code)) {
      store.restoreSession();
      onRestored();
      return;
    }
    setMessage(GENERIC_DOOR);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#1B1D1C",
      }}
    >
      <section
        className="rise"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ width: "min(420px, 100%)", textAlign: "center" }}>
          <p
            className="didot"
            style={{
              fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
              fontWeight: 400,
              fontSize: "clamp(42px, 8vw, 64px)",
              letterSpacing: "0.35em",
              paddingLeft: "0.35em",
              lineHeight: 1,
              margin: 0,
            }}
          >
            BOND
          </p>
          <div
            style={{
              width: "min(320px, 80%)",
              height: 1,
              background: "#E1DAD0",
              margin: "28px auto 0",
            }}
          />

          {step === "credentials" ? (
            <form action={onCredentials} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
              <p className="lbl" style={{ textAlign: "center", margin: "0 0 6px" }}>
                Sign in to continue
              </p>
              <input className="field" type="email" name="email" autoComplete="email" placeholder="Email" required />
              <input
                className="field"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                required
              />
              <button className="btn" type="submit" style={{ marginTop: 6 }}>
                Enter
              </button>
            </form>
          ) : (
            <form action={onMfa} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
              <p className="lbl" style={{ textAlign: "center", margin: "0 0 6px" }}>
                Enter your authentication code
              </p>
              <input
                className="field"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 digit code"
                maxLength={12}
                style={{ textAlign: "center", letterSpacing: "0.4em" }}
                required
              />
              <button className="btn" type="submit">
                Verify
              </button>
            </form>
          )}

          <p
            style={{
              fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
              fontSize: 14,
              fontStyle: "italic",
              color: "#B0A99A",
              margin: "22px 0 0",
              minHeight: 20,
            }}
          >
            {message}
          </p>
          <p className="lbl" style={{ margin: "34px 0 0" }}>
            Design preview . demo credential {DEMO_OWNER_EMAIL}
          </p>
        </div>
      </section>
    </main>
  );
}
