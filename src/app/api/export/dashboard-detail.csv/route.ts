import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { asCsv } from "@/lib/reporting";
import { resolveDateRange } from "@/lib/calendar-date";
import { getTenantTimeZone } from "@/lib/tenant";

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
  const timeZone = await getTenantTimeZone(user.tenantId);
  const dateRange = resolveDateRange(
    period,
    request.nextUrl.searchParams.get("dateFrom"),
    request.nextUrl.searchParams.get("dateTo"),
    timeZone
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
            select: { name: true }
          }
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }]
      })
    : [];

  const rows = entries.map((entry) => ({
    date: entry.date.toISOString().slice(0, 10),
    ...(isAdmin ? { employee: entry.user.name } : {}),
    client: entry.client.name,
    workstream: entry.workstream.name,
    start_time: entry.startTime ? entry.startTime.toISOString() : "",
    end_time: entry.endTime ? entry.endTime.toISOString() : "",
    hours: (entry.durationMinutes / 60).toFixed(2),
    type: entry.isBillable ? "Client Work" : "Firm Work",
    notes: entry.notes ?? ""
  }));

  const csv = asCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=dashboard-detail.csv"
    }
  });
}
