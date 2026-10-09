import { getSignupStore } from "@/lib/signups";
import { applyUnsubscribe, rfc8058OneClick } from "@/lib/signups/haus-updates";

export const dynamic = "force-dynamic";

function page(text: string, status: number) {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Bond Haus</title></head><body><p>${text}</p></body></html>`;
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

async function finish(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const result = await applyUnsubscribe(token, getSignupStore());
  if (!result.ok && result.reason === "token") {
    return page("This unsubscribe link is not valid.", 400);
  }
  if (!result.ok) {
    return page("Bond Haus unsubscribe is not available.", 503);
  }
  return page(
    "You are unsubscribed from Bond Haus updates. The email is deleted. A keyed hash is kept so it is not added again.",
    200,
  );
}

export async function GET(request: Request) {
  return finish(request);
}

// RFC 8058 List-Unsubscribe-Post. A mailbox posts List-Unsubscribe=One-Click
// to this URL. The signed token is the query string. A guessed URL does not match.
export async function POST(request: Request) {
  const body = await request.text();
  const oneClick = rfc8058OneClick(body, request.headers.get("List-Unsubscribe-Post"));
  const response = await finish(request);
  if (oneClick) response.headers.set("cache-control", "no-store");
  return response;
}
