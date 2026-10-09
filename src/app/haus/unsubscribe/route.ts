import { getSignupStore } from "@/lib/signups";
import { applyUnsubscribe, isOpaqueHausToken, rfc8058OneClick } from "@/lib/signups/haus-updates";

export const dynamic = "force-dynamic";

function page(text: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>${text}</p></body></html>`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function confirmPage(token: string) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>Confirm you want to unsubscribe from Bond Haus updates.</p><form method="post" action="/haus/unsubscribe?token=${token}"><button type="submit">Unsubscribe</button></form></body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isOpaqueHausToken(token)) return page("This unsubscribe link is not valid.", 400);
  const row = await getSignupStore().readHausUpdateToken(token);
  if (!row || row.purpose !== "unsub") return page("This unsubscribe link is not valid.", 400);
  return confirmPage(token);
}

// RFC 8058 List-Unsubscribe-Post. A mailbox posts List-Unsubscribe=One-Click
// to this URL. The token is an opaque id in the query string. A guessed URL does not match.
export async function POST(request: Request) {
  const body = await request.text();
  const oneClick = rfc8058OneClick(body, request.headers.get("List-Unsubscribe-Post"));
  const token = new URL(request.url).searchParams.get("token");
  const result = await applyUnsubscribe(token, getSignupStore());
  if (!result.ok) {
    return page("This unsubscribe link is not valid.", 400);
  }
  const response = page(
    "You are unsubscribed from Bond Haus updates. The email is deleted. A keyed hash is kept. Bond will not add that email again unless you opt back in yourself on your Haus page while signed in.",
    200,
  );
  if (oneClick) response.headers.set("cache-control", "no-store");
  return response;
}
