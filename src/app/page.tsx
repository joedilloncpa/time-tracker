import { redirect } from "next/navigation";
import { getUserContext, isAuthError } from "@/lib/auth";

export default async function HomePage() {
  if (process.env.AUTH_MODE === "dev") {
    redirect("/northstar-accounting/dashboard");
  }

  try {
    const user = await getUserContext();
    if (user.role === "super_admin") {
      redirect("/admin");
    }
    if (user.tenantSlug) {
      redirect(`/${user.tenantSlug}/dashboard`);
    }
  } catch (error) {
    if (isAuthError(error, ["unauthorized", "not_provisioned"])) {
      redirect("/login");
    }
    throw error;
  }

  redirect("/login");
}
