"use client";

import { useState, useTransition } from "react";
import { optInHausUpdatesAction } from "@/app/haus/actions";
import { hausCheckInputStyle, hausCheckRowStyle } from "@/app/haus/check-row";

export function HausUpdatesOptIn() {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  function onSave(formData: FormData) {
    start(async () => {
      setMessage("");
      const result = await optInHausUpdatesAction(formData);
      if (result?.message) setMessage(result.message);
    });
  }

  return (
    <form action={onSave} style={{ marginTop: 28, maxWidth: 520 }}>
      <label style={{ ...hausCheckRowStyle, marginLeft: 0, marginRight: 0 }}>
        <input type="checkbox" name="hausUpdates" value="1" style={hausCheckInputStyle} />
        <span>Send me Bond Haus updates by email. I can unsubscribe at any time.</span>
      </label>
      <button className="btn" type="submit" disabled={pending} style={{ marginTop: 16, maxWidth: 240 }}>
        Save
      </button>
      <p style={{ fontSize: 14, color: "#B0A99A", margin: "12px 0 0", minHeight: 20 }}>{pending ? "" : message}</p>
    </form>
  );
}
