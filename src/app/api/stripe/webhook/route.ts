import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook config" }, { status: 400 });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const metadata = session.metadata ?? {};
    const tenantId = metadata.tenantId;

    if (tenantId && typeof session.subscription === "string") {
      // Billing setup checkout (new flow): tenant already exists, link subscription
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: "active"
        }
      });
    } else {
      // Legacy flow: provision tenant from Stripe checkout metadata
      const firmName = metadata.firmName;
      const firmSlug = metadata.firmSlug;
      const adminEmail = metadata.adminEmail;
      const adminName = metadata.adminName ?? "Firm Admin";

      if (firmName && firmSlug && adminEmail) {
        await prisma.$transaction(async (tx) => {
          const tenant = await tx.tenant.upsert({
            where: { slug: firmSlug },
            create: {
              name: firmName,
              slug: firmSlug,
              stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              subscriptionStatus: "active"
            },
            update: {
              stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
              stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
              subscriptionStatus: "active"
            }
          });

          await tx.user.upsert({
            where: { email: adminEmail.toLowerCase() },
            create: {
              tenantId: tenant.id,
              email: adminEmail.toLowerCase(),
              name: adminName,
              role: "firm_admin"
            },
            update: {
              tenantId: tenant.id,
              role: "firm_admin",
              isActive: true
            }
          });
        });
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    const tenantId = subscription.metadata?.tenantId;
    if (tenantId) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionStatus: subscription.status }
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const tenantId = subscription.metadata?.tenantId;
    if (tenantId) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: "canceled",
          stripeSubscriptionId: null
        }
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
    if (subscriptionId) {
      await prisma.tenant.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: { subscriptionStatus: "past_due" }
      });
    }
  }

  return NextResponse.json({ received: true });
}
