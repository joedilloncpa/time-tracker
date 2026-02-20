"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

function normalizeNextPath(nextPath: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export default function AuthCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function run() {
      const code = searchParams.get("code");
      const nextPath = normalizeNextPath(searchParams.get("next"));

      if (!code) {
        router.replace(`/login?error=oauth_error&next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        router.replace(`/login?error=oauth_exchange_failed&next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const message = encodeURIComponent(error.message || "Unable to complete Google sign in");
        router.replace(`/login?error=oauth_exchange_failed&message=${message}&next=${encodeURIComponent(nextPath)}`);
        return;
      }

      router.replace(nextPath);
    }

    void run();
  }, [router, searchParams]);

  return <main className="min-h-screen bg-[#f7f4ef]" />;
}
