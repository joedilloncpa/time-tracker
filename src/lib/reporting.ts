import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function timeByClient(tenantId: string, from: Date, to: Date) {
  return prisma.timeEntry.groupBy({
    by: ["clientId"],
    where: {
      tenantId,
      deletedAt: null,
      date: {
        gte: from,
        lte: to
      }
    },
    _sum: {
      durationMinutes: true
    }
  });
}

export async function clientProfitability(tenantId: string, from: Date, to: Date) {
  const entries = await prisma.timeEntry.findMany({
    where: {
      tenantId,
      deletedAt: null,
      isBillable: true,
      date: {
        gte: from,
        lte: to
      }
    },
    include: {
      client: true,
      workstream: true,
      user: {
        select: {
          costRate: true
        }
      }
    }
  });

  const grouped = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      totalHours: number;
      billedValue: number;
      teamCost: number;
    }
  >();

  for (const entry of entries) {
    const current = grouped.get(entry.clientId) ?? {
      clientId: entry.clientId,
      clientName: entry.client.name,
      totalHours: 0,
      billedValue: 0,
      teamCost: 0
    };

    const hours = entry.durationMinutes / 60;
    const rate = Number(entry.workstream.billingRate ?? entry.client.defaultBillingRate ?? 0);
    const costRate = Number(entry.user.costRate ?? 0);

    current.totalHours += hours;
    current.billedValue += hours * rate;
    current.teamCost += hours * costRate;

    grouped.set(entry.clientId, current);
  }

  return [...grouped.values()].map((item) => {
    const grossProfit = item.billedValue - item.teamCost;
    const grossMargin = item.billedValue > 0 ? (grossProfit / item.billedValue) * 100 : 0;
    return {
      ...item,
      grossProfit,
      grossMargin
    };
  });
}

export function asCsv<T extends Record<string, Prisma.JsonValue | number | string | null>>(rows: T[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) {
            return "";
          }
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(",")
    );
  }

  return lines.join("\n");
}
