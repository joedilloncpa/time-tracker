import { PrismaClient } from "@prisma/client";
import { ensureFirmWorkArea } from "../src/lib/firm-work";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "northstar-accounting" },
    update: {
      name: "Northstar Accounting",
      subscriptionStatus: "active"
    },
    create: {
      name: "Northstar Accounting",
      slug: "northstar-accounting",
      timezone: "America/New_York",
      fiscalYearStart: 1,
      subscriptionStatus: "active"
    }
  });
  await ensureFirmWorkArea(prisma, tenant.id);

  const admin = await prisma.user.upsert({
    where: { email: "admin@northstar.example" },
    update: {
      tenantId: tenant.id,
      role: "firm_admin",
      costRate: 65,
      defaultBillingRate: 175,
      isActive: true
    },
    create: {
      tenantId: tenant.id,
      email: "admin@northstar.example",
      name: "Northstar Admin",
      role: "firm_admin",
      costRate: 65,
      defaultBillingRate: 175,
      employmentType: "full_time"
    }
  });

  await prisma.user.upsert({
    where: { email: "owner@platform.example" },
    update: {
      role: "super_admin",
      tenantId: null
    },
    create: {
      email: "owner@platform.example",
      name: "Platform Owner",
      role: "super_admin"
    }
  });

  const client = await prisma.client.upsert({
    where: {
      id: "cl_northstar_smithco"
    },
    update: {
      tenantId: tenant.id,
      name: "Smith & Co",
      code: "SMITH-CO"
    },
    create: {
      id: "cl_northstar_smithco",
      tenantId: tenant.id,
      name: "Smith & Co",
      code: "SMITH-CO",
      industry: "Bookkeeping",
      status: "active",
      defaultBillingRate: 185,
      tags: ["Monthly Close", "High Priority"]
    }
  });

  const workstream = await prisma.workstream.upsert({
    where: {
      id: "ws_northstar_monthly_close"
    },
    update: {
      tenantId: tenant.id,
      clientId: client.id,
      name: "Monthly Bookkeeping"
    },
    create: {
      id: "ws_northstar_monthly_close",
      tenantId: tenant.id,
      clientId: client.id,
      name: "Monthly Bookkeeping",
      serviceType: "Bookkeeping",
      billingType: "hourly",
      billingRate: 195,
      status: "active"
    }
  });

  const existingEntries = await prisma.timeEntry.count({ where: { tenantId: tenant.id } });
  if (existingEntries === 0) {
    await prisma.timeEntry.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: admin.id,
          clientId: client.id,
          workstreamId: workstream.id,
          date: new Date(),
          durationMinutes: 90,
          isBillable: true,
          notes: "Month-end reconciliation",
          tags: ["Review"]
        },
        {
          tenantId: tenant.id,
          userId: admin.id,
          clientId: client.id,
          workstreamId: workstream.id,
          date: new Date(),
          durationMinutes: 60,
          isBillable: false,
          notes: "Internal meeting",
          tags: ["Firm Meetings"]
        }
      ]
    });
  }

  console.log("Seeded demo tenant: northstar-accounting");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
