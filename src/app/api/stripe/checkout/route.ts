import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { jsonError } from "@/lib/http";
import { getAuthRedirectOrigin } from "@/lib/url";
import { FREE_USER_LIMIT, FREE_CLIENT_LIMIT, getTenantUsage } from "@/lib/subscription";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firmSlug = body.firmSlug;
    if (!firmSlug) {
      return jsonError("firmSlug is required");
    }

    const user = await getUserContext(firmSlug);
    if (user.role !== "firm_admin" && user.role !== "super_admin") {
      return jsonError("Only firm admins can manage billing", 403);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId ?? "" }
    });
    if (!tenant) {
      return jsonError("Tenant not found", 404);
    }

    if (tenant.stripeSubscriptionId) {
      return jsonError("Tenant already has a subscription. Use the customer portal.", 409);
    }

    const requestHeaders = await headers();
    const origin = getAuthRedirectOrigin(requestHeaders) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Calculate initial quantities based on current usage
    const { userCount, clientCount } = await getTenantUsage(tenant.id);
    const extraUsers = Math.max(0, userCount - FREE_USER_LIMIT);
    const extraClients = Math.max(0, clientCount - FREE_CLIENT_LIMIT);

    // Create or reuse Stripe customer
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        }
      });
      customerId = customer.id;

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId }
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_EXTRA_USERS!,
          quantity: extraUsers
        },
        {
          price: process.env.STRIPE_PRICE_EXTRA_CLIENTS!,
          quantity: extraClients
        }
      ],
      subscription_data: {
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        }
      },
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug
      },
      success_url: `${origin}/${firmSlug}/billing?setup=success`,
      cancel_url: `${origin}/${firmSlug}/billing?setup=cancelled`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return jsonError(message, 500);
  }
}
