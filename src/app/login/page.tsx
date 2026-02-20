import { redirect } from "next/navigation";
import type { Route } from "next";
import { getUserContext, isAuthError } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { prisma } from "@/lib/db";

function normalizeNextPath(nextPath: string | undefined) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }
  return nextPath;
}

async function getDefaultRedirect(user: Awaited<ReturnType<typeof getUserContext>>): Promise<Route> {
  if (user.isSuperAdmin) {
    const preferredFirm = await prisma.tenant.findFirst({
      where: { slug: "chainbridge" },
      select: { slug: true }
    });
    if (preferredFirm?.slug) {
      return `/${preferredFirm.slug}/dashboard` as Route;
    }
    if (user.tenantSlug) {
      return `/${user.tenantSlug}/dashboard` as Route;
    }
    const firstFirm = await prisma.tenant.findFirst({
      select: { slug: true },
      orderBy: { createdAt: "asc" }
    });
    if (firstFirm?.slug) {
      return `/${firstFirm.slug}/dashboard` as Route;
    }
    return "/login";
  }
  return user.tenantSlug ? (`/${user.tenantSlug}/dashboard` as Route) : "/";
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string; message?: string; oauth_code?: string; code?: string }>;
}) {
  if (process.env.AUTH_MODE === "dev") {
    redirect("/northstar-accounting/dashboard");
  }

  const params = await searchParams;
  const nextPath = normalizeNextPath(params.next);

  try {
    const user = await getUserContext();
    if (nextPath !== "/") {
      redirect(nextPath as Route);
    }
    redirect(await getDefaultRedirect(user));
  } catch (error) {
    if (!isAuthError(error, ["unauthorized", "not_provisioned"])) {
      throw error;
    }
  }

  const errorMessage =
    params.error === "not_provisioned"
      ? "Your account exists in auth, but has not been provisioned in Tally yet. Ask your firm admin to invite you."
      : params.error === "oauth_exchange_failed"
        ? (params.message || "Google sign in could not be completed. Please try again.")
        : params.error === "oauth_error"
          ? (params.message || "Google sign in was canceled or failed. Please try again.")
      : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-3">
        {errorMessage ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
        <LoginForm nextPath={nextPath} oauthCode={params.oauth_code ?? params.code ?? ""} />
      </div>
    </main>
  );
}
