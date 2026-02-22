"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

function normalizeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

export function LoginForm({ nextPath, oauthCode }: { nextPath: string; oauthCode: string }) {
  const safeNextPath = normalizeNextPath(nextPath);
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthHandled, setOauthHandled] = useState(false);
  const oauthInProgress = Boolean(oauthCode) && !error;

  useEffect(() => {
    async function completeOAuth() {
      if (!oauthCode || !supabase || oauthHandled) {
        return;
      }

      setOauthHandled(true);
      setLoading(true);
      setError("");
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(oauthCode);
      setLoading(false);

      if (exchangeError) {
        setError(exchangeError.message || "Unable to complete Google sign in");
        return;
      }

      window.location.replace(safeNextPath);
    }

    void completeOAuth();
  }, [oauthCode, oauthHandled, safeNextPath, supabase]);

  async function onPasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!supabase) {
      setError("Supabase auth environment variables are missing.");
      return;
    }
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message || "Unable to sign in");
      return;
    }

    window.location.assign(safeNextPath);
  }

  async function onGoogleSignIn() {
    setError("");
    if (!supabase) {
      setError("Supabase auth environment variables are missing.");
      return;
    }
    setLoading(true);

    const callbackNext = encodeURIComponent(safeNextPath);
    const redirectTo = `${window.location.origin}/auth/complete?next=${callbackNext}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });

    if (oauthError) {
      setLoading(false);
      setError(oauthError.message || "Unable to start Google sign in");
    }
  }

  return (
    <div className="card w-full max-w-md space-y-4">
      <div className="space-y-1">
        <h1
          className="cb-display text-[3.1rem] leading-none tracking-[-0.03em] text-[#1c3a28]"
          style={{ fontFamily: "Baskerville, 'Times New Roman', serif", fontWeight: 600 }}
        >
          Tally<span className="text-[#c4531a]">.</span>
        </h1>
        <p className="text-sm text-[#7a7a70]">Sign in with Google or email and password.</p>
      </div>

      {oauthInProgress ? (
        <p className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] px-3 py-2 text-sm text-[#1c3a28]">
          Completing Google sign-in...
        </p>
      ) : (
        <>
          <button className="button-secondary h-11 w-full text-base" disabled={loading} onClick={onGoogleSignIn} type="button">
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#ddd9d0]" />
            <span className="text-xs uppercase tracking-[0.12em] text-[#7a7a70]">or</span>
            <div className="h-px flex-1 bg-[#ddd9d0]" />
          </div>

          <form className="space-y-3" onSubmit={onPasswordSignIn}>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[#1c3a28]">Email</span>
              <input
                autoComplete="email"
                className="input h-11"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[#1c3a28]">Password</span>
              <input
                autoComplete="current-password"
                className="input h-11"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button className="button h-11 w-full text-base" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
