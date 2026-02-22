import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getUserContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { jsonError } from "@/lib/http";
import { getAuthRedirectOrigin } from "@/lib/url";

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
      where: { id: user.tenantId ?? "" },
      select: { stripeCustomerId: true, slug: true }
    });
    if (!tenant?.stripeCustomerId) {
      return jsonError("No billing account found. Set up billing first.", 404);
    }

    const requestHeaders = await headers();
    const origin = getAuthRedirectOrigin(requestHeaders) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${origin}/${firmSlug}/billing`
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return jsonError(message, 500);
  }
}
