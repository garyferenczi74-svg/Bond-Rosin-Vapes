import type { ReactNode } from "react";
import type { SignupLedger } from "@/lib/signups/types";

export function SignupLedger({ ledger }: { ledger: SignupLedger }) {
  return (
    <section aria-label="Sign-ups" style={{ padding: "20px 24px 0", color: "#E1DAD0" }}>
      <h2 style={{ fontFamily: "GFS Didot, Didot, serif", fontWeight: 400, fontSize: 22, margin: "0 0 8px" }}>
        Sign-ups
      </h2>
      <p style={{ color: "#B0A99A", fontSize: 14, margin: "0 0 16px" }}>
        Owner read. Stored by Bond. Not sent to the state tracking system.
      </p>
      {ledger.unavailable ? (
        <p style={{ color: "#B0A99A" }}>Sign-up tables are not on this database yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 18 }}>
          <LedgerBlock title="Dispensary accounts">
            {ledger.dispensaries.length === 0 ? <Empty /> : null}
            {ledger.dispensaries.map((row) => (
              <p key={row.id} style={{ margin: "0 0 6px" }}>
                {row.dispensaryName} · {row.email} · {row.ocmLicense} · {row.status}
              </p>
            ))}
          </LedgerBlock>
          <LedgerBlock title="Order requests">
            {ledger.orders.length === 0 ? <Empty /> : null}
            {ledger.orders.map((row) => (
              <p key={row.id} style={{ margin: "0 0 6px" }}>
                {row.id} · {row.dispensaryAccountId} · {row.lineCount} lines · {row.promisedOn}
              </p>
            ))}
          </LedgerBlock>
          <LedgerBlock title="Haus sign-ups">
            {ledger.haus.length === 0 ? <Empty /> : null}
            {ledger.haus.map((row) => (
              <p key={row.id} style={{ margin: "0 0 6px" }}>
                {row.email} · {row.age21AckAt}
              </p>
            ))}
          </LedgerBlock>
        </div>
      )}
    </section>
  );
}

function LedgerBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8E887C", margin: "0 0 8px" }}>
        {title}
      </h3>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Empty() {
  return <p style={{ margin: 0, color: "#8E887C" }}>None yet.</p>;
}
