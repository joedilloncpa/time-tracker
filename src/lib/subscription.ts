import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";

export const FREE_USER_LIMIT = 2;
export const FREE_CLIENT_LIMIT = 1;

function getExtraUsersPriceId(): string {
  const id = process.env.STRIPE_PRICE_EXTRA_USERS;
  if (!id) throw new Error("STRIPE_PRICE_EXTRA_USERS is not set");
  return id;
}

function getExtraClientsPriceId(): string {
  const id = process.env.STRIPE_PRICE_EXTRA_CLIENTS;
  if (!id) throw new Error("STRIPE_PRICE_EXTRA_CLIENTS is not set");
  return id;
}

export async function getTenantUsage(tenantId: string) {
  const [userCount, clientCount] = await Promise.all([
    prisma.user.count({
      where: { tenantId, isActive: true }
    }),
    prisma.client.count({
      where: {
        tenantId,
        status: { not: "inactive" },
        code: { not: INTERNAL_FIRM_CLIENT_CODE }
      }
    })
  ]);

  return { userCount, clientCount };
}

export type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "needs_billing" | "stripe_error"; message: string };

/**
 * Check if adding one more user is allowed.
 * If a Stripe subscription exists, auto-syncs quantities.
 */
export async function checkAndHandleUserLimit(tenantId: string): Promise<LimitCheckResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true }
  });

  const { userCount } = await getTenantUsage(tenantId);

  // Adding one more would bring total to userCount + 1
  if (userCount + 1 <= FREE_USER_LIMIT) {
    return { allowed: true };
  }

  if (!tenant?.stripeSubscriptionId) {
    return {
      allowed: false,
      reason: "needs_billing",
      message: `You've reached the free plan limit of ${FREE_USER_LIMIT} users. Set up billing to add more team members.`
    };
  }

  try {
    await syncSubscriptionQuantities(tenant.stripeSubscriptionId, tenantId);
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: "stripe_error",
      message: error instanceof Error ? error.message : "Failed to update subscription"
    };
  }
}

/**
 * Check if adding one more client is allowed.
 * If a Stripe subscription exists, auto-syncs quantities.
 */
export async function checkAndHandleClientLimit(tenantId: string): Promise<LimitCheckResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true }
  });

  const { clientCount } = await getTenantUsage(tenantId);

  if (clientCount + 1 <= FREE_CLIENT_LIMIT) {
    return { allowed: true };
  }

  if (!tenant?.stripeSubscriptionId) {
    return {
      allowed: false,
      reason: "needs_billing",
      message: `You've reached the free plan limit of ${FREE_CLIENT_LIMIT} client. Set up billing to add more clients.`
    };
  }

  try {
    await syncSubscriptionQuantities(tenant.stripeSubscriptionId, tenantId);
    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: "stripe_error",
      message: error instanceof Error ? error.message : "Failed to update subscription"
    };
  }
}

/**
 * Sync Stripe subscription item quantities with actual tenant usage.
 * Called after adding/removing users or clients when a subscription exists.
 */
export async function syncSubscriptionQuantities(
  subscriptionId: string,
  tenantId: string
) {
  const { userCount, clientCount } = await getTenantUsage(tenantId);
  const extraUsers = Math.max(0, userCount - FREE_USER_LIMIT);
  const extraClients = Math.max(0, clientCount - FREE_CLIENT_LIMIT);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items"]
  });

  const usersPriceId = getExtraUsersPriceId();
  const clientsPriceId = getExtraClientsPriceId();

  const usersItem = subscription.items.data.find(
    (item) => item.price.id === usersPriceId
  );
  const clientsItem = subscription.items.data.find(
    (item) => item.price.id === clientsPriceId
  );

  const updates: Parameters<typeof stripe.subscriptions.update>[1] = { items: [] };

  if (usersItem && usersItem.quantity !== extraUsers) {
    updates.items!.push({ id: usersItem.id, quantity: extraUsers });
  } else if (!usersItem && extraUsers > 0) {
    updates.items!.push({ price: usersPriceId, quantity: extraUsers });
  }

  if (clientsItem && clientsItem.quantity !== extraClients) {
    updates.items!.push({ id: clientsItem.id, quantity: extraClients });
  } else if (!clientsItem && extraClients > 0) {
    updates.items!.push({ price: clientsPriceId, quantity: extraClients });
  }

  if (updates.items!.length > 0) {
    await stripe.subscriptions.update(subscriptionId, updates);
  }
}
