import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  if (process.env.AUTH_MODE !== "dev" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const cookieStore = await cookies();
    type CookieToSet = {
      name: string;
      value: string;
      options?: Parameters<typeof cookieStore.set>[2];
    };
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookieValues: CookieToSet[]) {
            cookieValues.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          }
        }
      }
    );
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}
