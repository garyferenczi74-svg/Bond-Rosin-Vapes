import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IDLE_COOKIE, isIdleExpired } from "@/lib/access";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bond-path", request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!url || !key) {
    return { response, userId: null as string | null, idleExpired: false };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rawIdle = request.cookies.get(IDLE_COOKIE)?.value;
  const last = rawIdle ? Number(rawIdle) : 0;
  const idleExpired = Boolean(user) && Boolean(rawIdle) && isIdleExpired(last);

  if (idleExpired) {
    await supabase.auth.signOut();
    response.cookies.set(IDLE_COOKIE, "", { path: "/", maxAge: 0 });
    return { response, userId: null, idleExpired: true };
  }

  if (user) {
    response.cookies.set(IDLE_COOKIE, String(Date.now()), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
    });
  }

  return { response, userId: user?.id ?? null, idleExpired: false };
}
