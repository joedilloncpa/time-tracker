import { prisma } from "@/lib/db";
import { DEFAULT_TIME_ZONE } from "@/lib/calendar-date";

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } });
}

export async function assertTenantBySlug(slug: string) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) {
    throw new Error("Firm not found");
  }
  return tenant;
}

export async function getTenantTimeZone(tenantId: string | null | undefined) {
  if (!tenantId) {
    return DEFAULT_TIME_ZONE;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true }
  });
  return tenant?.timezone || DEFAULT_TIME_ZONE;
}
