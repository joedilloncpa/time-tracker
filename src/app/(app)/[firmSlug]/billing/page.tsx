import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function BillingPage({
  params
}: {
  params: Promise<{ firmSlug: string }>;
}) {
  const { firmSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: firmSlug } });

  return (
    <main className="mx-auto max-w-2xl space-y-4 py-10">
      <div className="card space-y-3">
        <h1 className="text-2xl font-semibold text-brand-900">Billing Required</h1>
        <p className="text-slate-700">
          Subscription status: <strong>{tenant?.subscriptionStatus ?? "unknown"}</strong>
        </p>
        <p className="text-slate-600">
          This firm is not currently active. Re-activate via Stripe Checkout or Customer Portal.
        </p>
        <div className="flex gap-2">
          <Link href="/" className="button-secondary">Back home</Link>
        </div>
      </div>
    </main>
  );
}
