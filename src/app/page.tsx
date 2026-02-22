import { redirect } from "next/navigation";
import { getUserContext, isAuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LandingPage } from "@/components/landing-page";

export default async function HomePage() {
  if (process.env.AUTH_MODE === "dev") {
    redirect("/northstar-accounting/dashboard");
  }

  try {
    const user = await getUserContext();
    if (user.isSuperAdmin) {
      const preferredFirm = await prisma.tenant.findFirst({
        where: { slug: "chainbridge" },
        select: { slug: true }
      });
      if (preferredFirm?.slug) {
        redirect(`/${preferredFirm.slug}/dashboard`);
      }
      if (user.tenantSlug) {
        redirect(`/${user.tenantSlug}/dashboard`);
      }
      const firstFirm = await prisma.tenant.findFirst({
        select: { slug: true },
        orderBy: { createdAt: "asc" }
      });
      if (firstFirm?.slug) {
        redirect(`/${firstFirm.slug}/dashboard`);
      }
      redirect("/login");
    }
    if (user.tenantSlug) {
      redirect(`/${user.tenantSlug}/dashboard`);
    }
  } catch (error) {
    if (!isAuthError(error, ["unauthorized", "not_provisioned"])) {
      throw error;
    }
  }

  return <LandingPage />;
}
