import { NextRequest, NextResponse } from "next/server";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { asCsv } from "@/lib/reporting";

function getDateRange(
  period: "all" | "this_week" | "last_week" | "this_month" | "last_month" | "custom",
  dateFrom?: string | null,
  dateTo?: string | null
) {
  if (period === "all") {
    return null;
  }

  if (period === "custom" && dateFrom && dateTo) {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { from, to };
    }
  }

  const now = new Date();
  if (period === "this_week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  if (period === "last_week") {
    const base = subWeeks(now, 1);
    return { from: startOfWeek(base, { weekStartsOn: 1 }), to: endOfWeek(base, { weekStartsOn: 1 }) };
  }
  if (period === "this_month") {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }
  if (period === "last_month") {
    const base = subMonths(now, 1);
    return { from: startOfMonth(base), to: endOfMonth(base) };
  }
  return null;
}

function parseIds(raw: string | null) {
  return (raw ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
  const periodRaw = request.nextUrl.searchParams.get("period");
  const period =
    periodRaw === "all" ||
    periodRaw === "this_week" ||
    periodRaw === "last_week" ||
    periodRaw === "this_month" ||
    periodRaw === "last_month" ||
    periodRaw === "custom"
      ? periodRaw
      : "all";
  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";
  const showBillable = request.nextUrl.searchParams.get("billable") !== "0";
  const showNonBillable = request.nextUrl.searchParams.get("nonBillable") !== "0";
  const dateRange = getDateRange(
    period,
    request.nextUrl.searchParams.get("dateFrom"),
    request.nextUrl.searchParams.get("dateTo")
  );
  const selectedClientIds = parseIds(request.nextUrl.searchParams.get("clientIds"));
  const selectedEmployeeIds = parseIds(request.nextUrl.searchParams.get("employeeIds"));
  const selectedWorkstreamIds = parseIds(request.nextUrl.searchParams.get("workstreamIds"));
  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";

  const entries = showBillable || showNonBillable
    ? await prisma.timeEntry.findMany({
        where: {
          tenantId: user.tenantId ?? "",
          deletedAt: null,
          ...(dateRange ? { date: { gte: dateRange.from, lte: dateRange.to } } : {}),
          ...(selectedWorkstreamIds.length ? { workstreamId: { in: selectedWorkstreamIds } } : {}),
          ...(showBillable && showNonBillable ? {} : showBillable ? { isBillable: true } : { isBillable: false }),
          ...(selectedClientIds.length ? { clientId: { in: selectedClientIds } } : {}),
          ...(isAdmin
            ? (selectedEmployeeIds.length ? { userId: { in: selectedEmployeeIds } } : {})
            : { userId: user.id }),
          ...(includeInactive ? {} : { client: { status: "active" } })
        },
        include: {
          client: true,
          workstream: true,
          user: {
            select: { costRate: true }
          }
        }
      })
    : [];

  const clientRows = new Map<
    string,
    {
      client: string;
      hours: number;
      total_billing: number;
      average_rate: number;
      total_cost: number;
      average_cost: number;
      profit_loss: number;
    }
  >();

  for (const entry of entries) {
    const hours = entry.durationMinutes / 60;
    const rate = Number(entry.workstream.billingRate ?? entry.client.defaultBillingRate ?? 0);
    const costRate = Number(entry.user.costRate ?? 0);

    const current = clientRows.get(entry.clientId) ?? {
      client: entry.client.name,
      hours: 0,
      total_billing: 0,
      average_rate: 0,
      total_cost: 0,
      average_cost: 0,
      profit_loss: 0
    };

    current.hours += hours;
    current.total_billing += entry.isBillable ? hours * rate : 0;
    current.total_cost += hours * costRate;
    clientRows.set(entry.clientId, current);
  }

  const rows = [...clientRows.values()].map((row) => {
    const averageRate = row.hours > 0 ? row.total_billing / row.hours : 0;
    const averageCost = row.hours > 0 ? row.total_cost / row.hours : 0;
    const profitLoss = row.total_billing - row.total_cost;
    return {
      client: row.client,
      hours: row.hours.toFixed(2),
      ...(isAdmin
        ? {
            total_billing: row.total_billing.toFixed(2),
            average_rate: averageRate.toFixed(2),
            total_cost: row.total_cost.toFixed(2),
            average_cost: averageCost.toFixed(2),
            profit_loss: profitLoss.toFixed(2)
          }
        : {})
    };
  });

  const csv = asCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dashboard-summary.csv"
    }
  });
}
