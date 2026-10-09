import { getSignupStore } from "@/lib/signups";
import { confirmHausUpdate, hausUpdatesDoubleOptInEnabled, isOpaqueHausToken } from "@/lib/signups/haus-updates";

export const dynamic = "force-dynamic";

function page(text: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>${text}</p></body></html>`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function confirmPage(token: string) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>Confirm Bond Haus updates.</p><form method="post" action="/haus/updates/confirm?token=${token}"><button type="submit">Confirm</button></form></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function offPage() {
  return page("Bond Haus update confirmation is off. No email is sent.", 200);
}

export async function GET(request: Request) {
  if (!hausUpdatesDoubleOptInEnabled()) return offPage();
  const token = new URL(request.url).searchParams.get("token");
  if (!isOpaqueHausToken(token)) return page("This confirmation link is not valid.", 400);
  const row = await getSignupStore().readHausUpdateToken(token);
  if (!row || row.purpose !== "confirm") return page("This confirmation link is not valid.", 400);
  return confirmPage(token);
}

export async function POST(request: Request) {
  if (!hausUpdatesDoubleOptInEnabled()) return offPage();
  const token = new URL(request.url).searchParams.get("token");
  const result = await confirmHausUpdate(token, getSignupStore());
  if (!result.ok) return page("This confirmation link is not valid.", 400);
  return page("Bond Haus updates are confirmed.", 200);
}
