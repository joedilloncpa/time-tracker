import { prisma } from "@/lib/db";

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
