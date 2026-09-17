"use client";

import { useMemo, useState, useTransition } from "react";
import { closePartnerDoorAction, openPartnerDoorAction, submitPartnerRequestAction } from "@/app/order/actions";
import { ComplianceBand } from "@/components/compliance-band";
import { ORDER_COPY, PARTNER_SKU_LABELS } from "@/lib/order/copy";
import { writeLocalPartnerDrafts } from "@/lib/order/persist";
import { PARTNER_SKU_IDS } from "@/lib/order/types";
import { tokens } from "@/lib/tokens";

type SessionView = {
  email: string;
  accountId: string;
  license: string;
  accountName: string;
};

type GateView = { ok: true } | { ok: false; reason: string };

const DEFAULT_WEEK = "2026-09-22";

export function OrderClient({
  session,
  gate,
}: {
  session?: SessionView;
  gate?: GateView;
}) {
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"compose" | "review" | "filed">("compose");
  const [filedId, setFiledId] = useState("");
  const [qty, setQty] = useState<Record<(typeof PARTNER_SKU_IDS)[number], number>>({
    "no-1": 0,
    "no-2": 0,
    "no-3": 0,
  });
  const [promisedOn, setPromisedOn] = useState(DEFAULT_WEEK);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  const lines = useMemo(
    () =>
      PARTNER_SKU_IDS.filter((skuId) => qty[skuId] > 0).map((skuId) => ({
        skuId,
        format: "1g",
        qty: qty[skuId],
      })),
    [qty],
  );

  function onOpen(formData: FormData) {
    start(async () => {
      setMessage("");
      const result = await openPartnerDoorAction(formData);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      window.location.reload();
    });
  }

  function onClose() {
    start(async () => {
      await closePartnerDoorAction();
      window.location.reload();
    });
  }

  function onReview() {
    setMessage("");
    if (!lines.length) {
      setMessage(ORDER_COPY.emptyLines);
      return;
    }
    setStep("review");
  }

  function onSubmit() {
    start(async () => {
      setMessage("");
      const result = await submitPartnerRequestAction({
        lines,
        promisedOn,
        notes,
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      writeLocalPartnerDrafts({
        orders: [
          {
            id: result.id,
            accountId: session?.accountId ?? "",
            stage: "draft",
            promisedOn,
            late: false,
            manifestNumber: "",
            lines: lines.map((line) => ({
              ...line,
              batchLabel: "Unallocated request",
              lotId: "",
              metrcUid: "",
            })),
            documents: "Partner request. Draft only. No Metrc write.",
            notes,
            source: "partner",
          },
        ],
        events: [
          {
            id: `local-${result.id}`,
            time: "00:00:00",
            agent: "Q",
            type: "ORDER_REQUEST",
            summary: "ORDER_REQUEST",
            sub: `${result.id} . ${session?.accountName ?? "account"} . draft . no Metrc write`,
            audit: "A-partner",
          },
        ],
      });
      setFiledId(result.id);
      setStep("filed");
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: tokens.matteBlack,
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
        <span
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 19,
            letterSpacing: "0.35em",
            paddingLeft: "0.35em",
          }}
        >
          BOND
        </span>
        <a
          href="/Home.dc.html"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontSize: 12,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: tokens.muted,
            border: `1px solid ${tokens.line}`,
            borderRadius: 2,
            padding: "8px 14px",
          }}
        >
          {ORDER_COPY.mainPage}
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
        {!session ? (
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
            <p
              className="didot"
              style={{
                fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
                fontWeight: 400,
                fontSize: "clamp(16px, 2vw, 22px)",
                letterSpacing: "0.16em",
                color: tokens.bone,
                margin: "22px 0 0",
              }}
            >
              {ORDER_COPY.doorTitle}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: tokens.muted, margin: "12px 0 0" }}>
              {ORDER_COPY.doorLine}
            </p>
            <div
              style={{
                width: "min(320px, 80%)",
                height: 1,
                background: tokens.bone,
                margin: "28px auto 0",
              }}
            />
            <form action={onOpen} style={{ marginTop: 34, display: "grid", gap: 14, textAlign: "left" }}>
              <input className="field" type="email" name="email" autoComplete="email" placeholder={ORDER_COPY.email} required />
              <input className="field" name="inviteCode" autoComplete="off" placeholder={ORDER_COPY.invite} required />
              <input className="field" name="license" autoComplete="off" placeholder={ORDER_COPY.license} required />
              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  color: "#B0A99A",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" name="age21" value="1" />
                {ORDER_COPY.age21}
              </label>
              <button className="btn" type="submit" disabled={pending} style={{ marginTop: 6 }}>
                {ORDER_COPY.enter}
              </button>
            </form>
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
        ) : (
          <div style={{ width: "min(720px, 100%)" }}>
            <p className="lbl" style={{ margin: "0 0 8px" }}>
              {ORDER_COPY.formTitle}
            </p>
            <h1
              className="didot"
              style={{
                fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
                fontWeight: 400,
                fontSize: "clamp(28px, 4vw, 40px)",
                margin: 0,
              }}
            >
              {session.accountName}
            </h1>
            <p style={{ fontSize: 13, color: tokens.muted, margin: "10px 0 0" }}>
              {session.license} . {session.email}
            </p>
            <p style={{ fontSize: 13, color: tokens.muted, margin: "8px 0 0" }}>
              {ORDER_COPY.formLine} {ORDER_COPY.licenseCheck}
            </p>
            {gate && gate.ok === false ? (
              <p
                className="card"
                style={{ marginTop: 18, boxShadow: "inset 0 1px 0 var(--product)" }}
                role="status"
              >
                {gate.reason}
              </p>
            ) : null}

            {step === "filed" ? (
              <div className="card" style={{ marginTop: 22, boxShadow: "inset 0 1px 0 var(--product)" }}>
                <p style={{ margin: 0, fontSize: 15, color: tokens.bone }}>{ORDER_COPY.filed}</p>
                <p className="mono" style={{ margin: "10px 0 0", color: tokens.bone }}>
                  {filedId}
                </p>
                <button className="btn" type="button" onClick={onClose} disabled={pending} style={{ marginTop: 18, maxWidth: 220 }}>
                  {ORDER_COPY.close}
                </button>
              </div>
            ) : null}

            {step !== "filed" ? (
              <>
                <div className="vx-sku-grid" style={{ marginTop: 22 }}>
                  {PARTNER_SKU_IDS.map((skuId) => (
                    <label key={skuId} className="vx-sku-card" style={{ boxShadow: "inset 0 1px 0 var(--product)" }}>
                      <span className="lbl">{PARTNER_SKU_LABELS[skuId]}</span>
                      <span className="vx-sku-name">{ORDER_COPY.qty}</span>
                      <input
                        className="field"
                        type="number"
                        min={0}
                        value={qty[skuId]}
                        disabled={step === "review" || (gate && gate.ok === false)}
                        onChange={(event) =>
                          setQty((current) => ({
                            ...current,
                            [skuId]: Math.max(0, Number(event.target.value) || 0),
                          }))
                        }
                        style={{ marginTop: 12 }}
                      />
                    </label>
                  ))}
                </div>
                <div className="vx-form-grid" style={{ marginTop: 16 }}>
                  <label>
                    <span className="lbl">{ORDER_COPY.shipWeek}</span>
                    <input
                      className="field"
                      type="date"
                      value={promisedOn}
                      disabled={step === "review" || (gate && gate.ok === false)}
                      onChange={(event) => setPromisedOn(event.target.value)}
                    />
                  </label>
                  <label style={{ gridColumn: "span 2" }}>
                    <span className="lbl">{ORDER_COPY.notes}</span>
                    <textarea
                      className="field"
                      rows={3}
                      maxLength={500}
                      value={notes}
                      disabled={step === "review" || (gate && gate.ok === false)}
                      placeholder={ORDER_COPY.notesHint}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                </div>
                {step === "review" ? (
                  <div className="card" style={{ marginTop: 16 }}>
                    <p className="lbl" style={{ margin: "0 0 10px" }}>
                      {ORDER_COPY.review}
                    </p>
                    {lines.map((line) => (
                      <p key={line.skuId} style={{ margin: "0 0 6px", fontSize: 13, color: tokens.bone }}>
                        {PARTNER_SKU_LABELS[line.skuId]} . {line.qty} . {line.format}
                      </p>
                    ))}
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: tokens.muted }}>
                      {ORDER_COPY.shipWeek} {promisedOn}
                    </p>
                    {notes ? (
                      <p style={{ margin: "8px 0 0", fontSize: 13, color: tokens.muted }}>
                        {ORDER_COPY.notes} {notes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p
                  style={{
                    fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
                    fontSize: 14,
                    fontStyle: "italic",
                    color: "#B0A99A",
                    margin: "18px 0 0",
                    minHeight: 20,
                  }}
                >
                  {pending ? "" : message}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {step === "compose" ? (
                    <button
                      className="btn"
                      type="button"
                      disabled={pending || (gate && gate.ok === false)}
                      onClick={onReview}
                      style={{ maxWidth: 240 }}
                    >
                      {gate && gate.ok === false ? ORDER_COPY.blockedSubmit : ORDER_COPY.review}
                    </button>
                  ) : (
                    <>
                      <button className="btn" type="button" disabled={pending} onClick={() => setStep("compose")} style={{ maxWidth: 160 }}>
                        {ORDER_COPY.back}
                      </button>
                      <button
                        className="btn"
                        type="button"
                        disabled={pending || (gate && gate.ok === false)}
                        onClick={onSubmit}
                        style={{ maxWidth: 240, boxShadow: "inset 0 1px 0 var(--product)" }}
                      >
                        {ORDER_COPY.submit}
                      </button>
                    </>
                  )}
                  <button className="vx-act" type="button" disabled={pending} onClick={onClose}>
                    {ORDER_COPY.close}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>
      <ComplianceBand />
    </main>
  );
}
