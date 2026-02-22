import { UserRole } from "@prisma/client";
import { getUserContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function getApiContextFromSearchParams(searchParams: URLSearchParams) {
  const firmSlug = searchParams.get("firmSlug") || undefined;
  const user = await getUserContext(firmSlug);

  if (user.role === "super_admin" && !firmSlug) {
    throw new Error("firmSlug is required for super admin API requests");
  }

  if (user.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { subscriptionStatus: true }
    });
    if (
      tenant &&
      tenant.subscriptionStatus !== "active" &&
      tenant.subscriptionStatus !== "trialing" &&
      tenant.subscriptionStatus !== "free" &&
      !tenant.subscriptionStatus.startsWith("past_due")
    ) {
      throw new Error("Subscription inactive");
    }
  }

  if (!user.tenantId) {
    throw new Error("Missing tenant context");
  }

  return { user, firmSlug };
}

export function requireRole(role: UserRole, allowed: UserRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("Forbidden");
  }
}
