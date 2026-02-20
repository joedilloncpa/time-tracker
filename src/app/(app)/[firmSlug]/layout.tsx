import { notFound, redirect } from "next/navigation";
import { FirmShell } from "@/components/firm-shell";
import { getUserContext, isAuthError } from "@/lib/auth";
import { assertTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { ensureFirmWorkArea, INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { getAllowedClientIdsForUser } from "@/lib/tenant-settings";
import { UserContext } from "@/lib/types";

export default async function FirmLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ firmSlug: string }>;
}) {
  const { firmSlug } = await params;
  const tenant = await assertTenantBySlug(firmSlug).catch(() => null);

  if (!tenant) {
    notFound();
  }

  let user: UserContext;
  try {
    user = await getUserContext(firmSlug);
  } catch (error) {
    if (isAuthError(error, ["unauthorized"])) {
      redirect(`/login?next=/${firmSlug}/dashboard`);
    }
    if (isAuthError(error, ["not_provisioned"])) {
      redirect(`/login?error=not_provisioned&next=/${firmSlug}/dashboard`);
    }
    throw error;
  }

  if (user.tenantId && user.tenantId !== tenant.id && user.role !== "super_admin") {
    notFound();
  }
  await ensureFirmWorkArea(prisma, tenant.id);
  const allowedClientIds = getAllowedClientIdsForUser(tenant.settingsJson, user.id, user.role);

  const timerClients = await prisma.client.findMany({
    where: {
      tenantId: tenant.id,
      status: "active",
      ...(allowedClientIds
        ? (allowedClientIds.length
          ? {
              OR: [
                { id: { in: allowedClientIds } },
                { code: INTERNAL_FIRM_CLIENT_CODE }
              ]
            }
          : { code: INTERNAL_FIRM_CLIENT_CODE })
        : {})
    },
    select: {
      id: true,
      name: true,
      code: true,
      workstreams: {
        where: {
          status: "active"
        },
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: "asc"
        }
      }
    },
    orderBy: {
      name: "asc"
    }
  });

  const activeTimer = await prisma.timerSession.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      startedAt: true
    }
  });

  return (
    <FirmShell
      activeTimer={activeTimer ? { id: activeTimer.id, startedAt: activeTimer.startedAt.toISOString() } : null}
      firmSlug={firmSlug}
      timerClients={timerClients}
      user={user}
    >
      {children}
    </FirmShell>
  );
}
