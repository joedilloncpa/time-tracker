import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const INTERNAL_FIRM_CLIENT_CODE = "__FIRM_INTERNAL__";
export const INTERNAL_FIRM_CLIENT_NAME = "Firm";
export const INTERNAL_FIRM_DEFAULT_WORKSTREAM = "Admin";

type DbLike = Prisma.TransactionClient | typeof prisma;

export async function ensureFirmWorkArea(db: DbLike, tenantId: string) {
  const existingFirmClient = await db.client.findFirst({
    where: { tenantId, code: INTERNAL_FIRM_CLIENT_CODE },
    select: { id: true }
  });

  const firmClient = existingFirmClient
    ? await db.client.update({
        where: { id: existingFirmClient.id },
        data: { name: INTERNAL_FIRM_CLIENT_NAME, status: "active" }
      })
    : await db.client.create({
        data: {
          tenantId,
          name: INTERNAL_FIRM_CLIENT_NAME,
          code: INTERNAL_FIRM_CLIENT_CODE,
          status: "active",
          tags: []
        }
      });

  const existingAdminWorkstream = await db.workstream.findFirst({
    where: { tenantId, clientId: firmClient.id, name: INTERNAL_FIRM_DEFAULT_WORKSTREAM },
    select: { id: true }
  });

  if (existingAdminWorkstream) {
    await db.workstream.update({
      where: { id: existingAdminWorkstream.id },
      data: { status: "active", billingRate: null }
    });
    return;
  }

  await db.workstream.create({
    data: {
      tenantId,
      clientId: firmClient.id,
      name: INTERNAL_FIRM_DEFAULT_WORKSTREAM,
      status: "active",
      billingType: "hourly",
      billingRate: null
    }
  });
}
