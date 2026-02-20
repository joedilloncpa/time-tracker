import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth";

export default async function LegacyLockedPeriodsPage({
  params
}: {
  params: Promise<{ firmSlug: string }>;
}) {
  const { firmSlug } = await params;
  const user = await getUserContext(firmSlug);
  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";
  redirect(`/${firmSlug}/settings${isAdmin ? "?section=period_locking" : ""}`);
}
