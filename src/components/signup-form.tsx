"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";

type SignupMode = "choose" | "firm" | "join";

export function SignupForm() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);
  const [mode, setMode] = useState<SignupMode>("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firmName, setFirmName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Provision tenant + user via server API
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          firmName: firmName.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Step 2: Create Supabase auth user (triggers confirmation email)
      if (!supabase) {
        setError("Auth is not configured.");
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/${data.tenantSlug}/dashboard`
        }
      });

      if (authError) {
        setError(authError.message || "Unable to create account");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }

    setLoading(false);
  }

  if (success) {
    return (
      <div className="card w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-[#1c3a28]">Check your email</h1>
        <p className="text-sm text-[#4a4a42]">
          We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your
          account, then log in.
        </p>
        <Link href="/login" className="button inline-flex px-6">
          Go to login
        </Link>
      </div>
    );
  }

  if (mode === "choose") {
    return (
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <p
            className="cb-display text-[3.1rem] leading-none tracking-[-0.03em] text-[#1c3a28]"
            style={{ fontFamily: "Baskerville, 'Times New Roman', serif", fontWeight: 600 }}
          >
            Tally<span className="text-[#c4531a]">.</span>
          </p>
          <p className="mt-2 text-sm text-[#7a7a70]">How would you like to get started?</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("firm")}
            className="card cursor-pointer text-left transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7f4ef]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c3a28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[#1c3a28]">Sign Up My Firm</h2>
            <p className="text-sm text-[#4a4a42]">
              Create a new firm account and start tracking time immediately. Free for up to 2 users
              and 1 client.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode("join")}
            className="card cursor-pointer text-left transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7f4ef]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c3a28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-[#1c3a28]">Join My Team</h2>
            <p className="text-sm text-[#4a4a42]">
              Your firm already uses Tally and you need to join their team.
            </p>
          </button>
        </div>

        <p className="text-center text-sm text-[#7a7a70]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#1c3a28] underline">
            Log in
          </Link>
        </p>
      </div>
    );
  }

  if (mode === "join") {
    return (
      <div className="card w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={() => setMode("choose")}
          className="text-sm text-[#7a7a70] hover:text-[#1c3a28]"
        >
          &larr; Back
        </button>
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f7f4ef]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1c3a28" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#1c3a28]">Join My Team</h2>
        <p className="text-sm leading-relaxed text-[#4a4a42]">
          Reach out to your Firm Administrator and ask to be invited to the platform. They can send
          you an invite from the <strong>Settings &rarr; Users &amp; Access</strong> page.
        </p>
        <p className="text-sm text-[#7a7a70]">
          Once you receive an invite email, click the link to set up your account and you&rsquo;ll
          be ready to go.
        </p>
        <Link href="/login" className="button-secondary inline-flex px-5">
          Go to login
        </Link>
      </div>
    );
  }

  // Firm signup form
  return (
    <div className="card w-full max-w-md space-y-4">
      <button
        type="button"
        onClick={() => setMode("choose")}
        className="text-sm text-[#7a7a70] hover:text-[#1c3a28]"
      >
        &larr; Back
      </button>

      <div className="space-y-1">
        <p
          className="cb-display text-[3.1rem] leading-none tracking-[-0.03em] text-[#1c3a28]"
          style={{ fontFamily: "Baskerville, 'Times New Roman', serif", fontWeight: 600 }}
        >
          Tally<span className="text-[#c4531a]">.</span>
        </p>
        <p className="text-sm text-[#7a7a70]">
          Create your firm account. Free to start &mdash; no credit card required.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSignupSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#1c3a28]">Your Name</span>
          <input
            autoComplete="name"
            className="input h-11"
            onChange={(e) => setName(e.target.value)}
            required
            type="text"
            value={name}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#1c3a28]">Email</span>
          <input
            autoComplete="email"
            className="input h-11"
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#1c3a28]">Firm Name</span>
          <input
            className="input h-11"
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="e.g. Northstar Accounting"
            required
            type="text"
            value={firmName}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-[#1c3a28]">Password</span>
          <input
            autoComplete="new-password"
            className="input h-11"
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button className="button h-11 w-full text-base" disabled={loading} type="submit">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <p className="text-center text-sm text-[#7a7a70]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#1c3a28] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
