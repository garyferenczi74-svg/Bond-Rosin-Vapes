"use client";

import { useState, useTransition } from "react";
import { signInAction, signOutAction, verifyMfaAction } from "@/app/haus/actions";
import { tokens } from "@/lib/tokens";

type Step = "credentials" | "mfa-enroll" | "mfa-challenge" | "member";

export function HausClient({ signedMember }: { signedMember: boolean }) {
  const [step, setStep] = useState<Step>(signedMember ? "member" : "credentials");
  const [message, setMessage] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSignIn(formData: FormData) {
    start(async () => {
      setMessage("");
      const result = await signInAction(formData);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      if (result.next === "member") {
        setStep("member");
        return;
      }
      if (result.next === "mfa-enroll") {
        setFactorId(result.factorId);
        setQr(result.qr);
        setStep("mfa-enroll");
        return;
      }
      setFactorId(result.factorId);
      setChallengeId(result.challengeId);
      setStep("mfa-challenge");
    });
  }

  function onVerify(formData: FormData) {
    start(async () => {
      setMessage("");
      const result = await verifyMfaAction(formData);
      if (result && !result.ok) {
        setMessage(result.message);
      }
    });
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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "26px clamp(20px, 4vw, 56px)",
        }}
      >
        <a
          href="/Home.dc.html"
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 19,
            letterSpacing: "0.35em",
            paddingLeft: "0.35em",
          }}
        >
          BOND
        </a>
        <a
          href="/Home.dc.html"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#8E887C",
            border: "1px solid #3A3C3B",
            borderRadius: 2,
            padding: "8px 14px",
          }}
        >
          Main page
        </a>
      </header>

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
            <>
              <form action={onSignIn} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
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
                <button className="btn" type="submit" disabled={pending} style={{ marginTop: 6 }}>
                  Enter
                </button>
              </form>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: tokens.muted,
                  margin: "22px 0 0",
                  textAlign: "center",
                }}
              >
                Not yet a member?{" "}
                <a
                  href="/#haus"
                  style={{
                    color: tokens.bone,
                    borderBottom: `1px solid ${tokens.line}`,
                    paddingBottom: 1,
                  }}
                >
                  Join the Circle for first access.
                </a>
              </p>
            </>
          ) : null}

          {step === "mfa-enroll" ? (
            <form action={onVerify} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
              <p className="lbl" style={{ textAlign: "center", margin: "0 0 6px" }}>
                Add an authenticator
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#8E887C", margin: 0, textAlign: "center" }}>
                Access does not open without a verified authenticator.
              </p>
              {qr ? (
                <div
                  className="card"
                  style={{ display: "flex", justifyContent: "center" }}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
              ) : (
                <p style={{ fontSize: 13, color: "#8E887C", textAlign: "center" }}>
                  Confirm the code from the authenticator already in progress.
                </p>
              )}
              <input type="hidden" name="factorId" value={factorId} />
              <input type="hidden" name="enroll" value="1" />
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
              <button className="btn" type="submit" disabled={pending}>
                Verify
              </button>
            </form>
          ) : null}

          {step === "mfa-challenge" ? (
            <form action={onVerify} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
              <p className="lbl" style={{ textAlign: "center", margin: "0 0 6px" }}>
                Enter your authentication code
              </p>
              <input type="hidden" name="factorId" value={factorId} />
              <input type="hidden" name="challengeId" value={challengeId} />
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
              <button className="btn" type="submit" disabled={pending}>
                Verify
              </button>
            </form>
          ) : null}

          {step === "member" ? (
            <div style={{ marginTop: 34 }}>
              <p className="lbl">Bond Haus</p>
              <p style={{ fontSize: 15, lineHeight: 1.7, color: "#E1DAD0", margin: "16px 0 0" }}>
                You are in the Haus.
              </p>
              <form action={signOutAction} style={{ marginTop: 22 }}>
                <button className="btn" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          ) : null}

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
            {pending ? "" : message}
          </p>
        </div>
      </section>
    </main>
  );
}
