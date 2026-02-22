import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserContext, isAuthError } from "@/lib/auth";
import { FREE_USER_LIMIT, FREE_CLIENT_LIMIT, getTenantUsage } from "@/lib/subscription";
import { BillingActions } from "@/components/billing-actions";

export default async function BillingPage({
  params,
  searchParams
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<{ setup?: string }>;
}) {
  const { firmSlug } = await params;
  const { setup } = await searchParams;

  let user;
  try {
    user = await getUserContext(firmSlug);
  } catch (error) {
    if (isAuthError(error, ["unauthorized"])) {
      redirect(`/login?next=/${firmSlug}/billing`);
    }
    if (isAuthError(error, ["not_provisioned"])) {
      redirect(`/login?error=not_provisioned&next=/${firmSlug}/billing`);
    }
    throw error;
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: firmSlug } });
  if (!tenant) {
    redirect("/");
  }

  const { userCount, clientCount } = await getTenantUsage(tenant.id);
  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";
  const hasSubscription = !!tenant.stripeSubscriptionId;

  const extraUsers = Math.max(0, userCount - FREE_USER_LIMIT);
  const extraClients = Math.max(0, clientCount - FREE_CLIENT_LIMIT);
  const monthlyCost = extraUsers + extraClients;

  return (
    <main className="space-y-6">
      <h1 className="pl-2 text-2xl font-semibold text-brand-900 md:pl-4">Billing &amp; Plan</h1>
      <div className="ml-2 max-w-2xl space-y-4 md:ml-4">
        {setup === "success" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Billing set up successfully. You can now add more users and clients.
          </div>
        ) : null}
        {setup === "cancelled" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Billing setup was cancelled. You can try again anytime.
          </div>
        ) : null}

        <div className="card space-y-4">
          <div className="space-y-1">
            <p className="text-sm text-[#4a4a42]">
              Plan:{" "}
              <strong className="text-[#1c3a28]">{hasSubscription ? "Pay as you grow" : "Free"}</strong>
            </p>
            {hasSubscription ? (
              <p className="text-sm text-[#7a7a70]">
                Estimated monthly cost: <strong className="text-[#1c3a28]">${monthlyCost}</strong>
                {monthlyCost === 0 ? " (within free tier)" : ""}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7a7a70]">
                Team Members
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1c3a28]">{userCount}</p>
              <p className="text-xs text-[#7a7a70]">
                {hasSubscription
                  ? `${FREE_USER_LIMIT} included free, then $1/mo each`
                  : `${userCount} of ${FREE_USER_LIMIT} free`}
              </p>
              {extraUsers > 0 && hasSubscription ? (
                <p className="mt-1 text-xs text-[#c4531a]">
                  {extraUsers} additional &middot; ${extraUsers}/mo
                </p>
              ) : null}
            </div>
            <div className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7a7a70]">
                Clients
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#1c3a28]">{clientCount}</p>
              <p className="text-xs text-[#7a7a70]">
                {hasSubscription
                  ? `${FREE_CLIENT_LIMIT} included free, then $1/mo each`
                  : `${clientCount} of ${FREE_CLIENT_LIMIT} free`}
              </p>
              {extraClients > 0 && hasSubscription ? (
                <p className="mt-1 text-xs text-[#c4531a]">
                  {extraClients} additional &middot; ${extraClients}/mo
                </p>
              ) : null}
            </div>
          </div>

          {!hasSubscription ? (
            <div className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] px-4 py-3">
              <p className="text-sm text-[#4a4a42]">
                Your free plan includes {FREE_USER_LIMIT} team members and {FREE_CLIENT_LIMIT} client.
                Need more? Set up billing to add users and clients for just <strong>$1/month each</strong>.
              </p>
            </div>
          ) : null}

          {isAdmin ? (
            <BillingActions firmSlug={firmSlug} hasSubscription={hasSubscription} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
