"use client";

import { useState } from "react";

export function BillingActions({
  firmSlug,
  hasSubscription
}: {
  firmSlug: string;
  hasSubscription: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openCheckout() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmSlug })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start billing setup");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Failed to start billing setup");
      setLoading(false);
    }
  }

  async function openPortal() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmSlug })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to open billing portal");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Failed to open billing portal");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!hasSubscription ? (
          <button
            className="button px-5"
            disabled={loading}
            onClick={openCheckout}
            type="button"
          >
            {loading ? "Loading..." : "Set up billing"}
          </button>
        ) : (
          <button
            className="button-secondary px-5"
            disabled={loading}
            onClick={openPortal}
            type="button"
          >
            {loading ? "Loading..." : "Manage billing & invoices"}
          </button>
        )}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
