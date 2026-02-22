import { redirect } from "next/navigation";
import { getUserContext, isAuthError } from "@/lib/auth";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  if (process.env.AUTH_MODE === "dev") {
    redirect("/northstar-accounting/dashboard");
  }

  try {
    const user = await getUserContext();
    if (user.tenantSlug) {
      redirect(`/${user.tenantSlug}/dashboard`);
    }
  } catch (error) {
    if (!isAuthError(error, ["unauthorized", "not_provisioned", "config"])) {
      throw error;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SignupForm />
    </main>
  );
}
