"use client";

import { useState, useTransition } from "react";
import { enterHausAction } from "@/app/haus/actions";
import { tokens } from "@/lib/tokens";

export function WelcomeClient({ needsAge }: { needsAge: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function onEnter(formData: FormData) {
    start(async () => {
      setMessage("");
      const result = await enterHausAction(formData);
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
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: tokens.matteBlack,
      }}
    >
      <div className="rise" style={{ textAlign: "center", maxWidth: 520 }}>
        <h1
          className="didot"
          style={{
            fontFamily: "var(--font-didot), 'GFS Didot', Didot, serif",
            fontWeight: 400,
            fontSize: "clamp(30px, 5vw, 44px)",
            letterSpacing: "0.04em",
            color: tokens.bone,
            margin: 0,
          }}
        >
          Welcome to the Haus.
        </h1>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.9,
            color: "#B0A99A",
            margin: "22px 0 0",
          }}
        >
          This floor is yours. Your shelf, your guide, your rituals, kept quietly.
        </p>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.9,
            color: "#B0A99A",
            margin: "8px 0 0",
          }}
        >
          Everything here is private, optional, and yours to erase.
        </p>
        <div
          style={{
            width: "min(300px, 70%)",
            height: 1,
            background: tokens.bone,
            margin: "30px auto 0",
          }}
        />
        <form action={onEnter} style={{ marginTop: 26 }}>
          {needsAge ? (
            <label
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                color: "#B0A99A",
                cursor: "pointer",
              }}
            >
              <input type="checkbox" name="age21" value="1" />
              For adults 21 and over.
            </label>
          ) : null}
          <button
            className="btn"
            type="submit"
            disabled={pending}
            style={{ marginTop: 22, maxWidth: 240 }}
          >
            Enter
          </button>
        </form>
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
      </div>
    </main>
  );
}
