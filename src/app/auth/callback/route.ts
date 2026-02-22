import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export async function GET(request: NextRequest) {
  const nextPath = normalizeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const oauthErrorDescription = request.nextUrl.searchParams.get("error_description");

  if (oauthError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth_error");
    if (oauthErrorDescription) {
      loginUrl.searchParams.set("message", oauthErrorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const cookieStore = await cookies();
    type CookieToSet = {
      name: string;
      value: string;
      options?: Parameters<typeof cookieStore.set>[2];
    };
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "oauth_exchange_failed");
      loginUrl.searchParams.set("message", exchangeError.message || "Unable to complete Google sign in");
      loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
