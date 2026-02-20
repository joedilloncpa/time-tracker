import { redirect } from "next/navigation";
import { getUserContext, isAuthError } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

function normalizeNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

function getDefaultRedirect(user: Awaited<ReturnType<typeof getUserContext>>) {
  if (user.role === "super_admin") {
    return "/admin";
  }
  return user.tenantSlug ? `/${user.tenantSlug}/dashboard` : "/";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (process.env.AUTH_MODE === "dev") {
    redirect("/northstar-accounting/dashboard");
  }

  const params = await searchParams;
  const nextPath = normalizeNextPath(params.next);

  try {
    const user = await getUserContext();
    redirect(getDefaultRedirect(user));
  } catch (error) {
    if (!isAuthError(error, ["unauthorized", "not_provisioned"])) {
      throw error;
    }
  }

  const errorMessage =
    params.error === "not_provisioned"
      ? "Your account exists in auth, but has not been provisioned in Tally yet. Ask your firm admin to invite you."
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-3">
        {errorMessage ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
