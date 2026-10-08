import { OrderClient } from "@/app/order/order-client";
import { readPartnerSession, readSessionPartnerAccount } from "@/lib/order/session";
import { getVauxhallStore } from "@/lib/vauxhall/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispensary Login",
  robots: { index: false, follow: false },
};

export default async function OrderPage() {
  const session = await readPartnerSession();
  const account = await readSessionPartnerAccount();
  if (!session || !account) {
    return <OrderClient />;
  }

  const elevated = account.elevated;
  const sessionView = {
    email: session.email,
    accountId: session.accountId,
    license: session.license,
    accountName: account.dispensaryName || account.license,
    elevated,
  };

  if (!elevated) {
    return <OrderClient session={sessionView} />;
  }

  const store = getVauxhallStore();
  const wholesale = store.accountById(session.accountId);
  const storeGate = store.orderGate(session.accountId);
  const gate = storeGate.ok
    ? { ok: true as const }
    : { ok: false as const, reason: storeGate.reason };

  return (
    <OrderClient
      session={{
        ...sessionView,
        accountName: wholesale?.name ?? sessionView.accountName,
      }}
      gate={gate}
    />
  );
}
