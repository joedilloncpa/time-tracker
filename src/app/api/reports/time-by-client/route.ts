import { NextRequest, NextResponse } from "next/server";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { timeByClient } from "@/lib/reporting";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { calendarDateToUtc, endOfCalendarDayUtc, resolveDateRange } from "@/lib/calendar-date";
import { getTenantTimeZone } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    const timeZone = await getTenantTimeZone(user.tenantId);
    const thisMonth = resolveDateRange("this_month", null, null, timeZone)!;
    const start = from ? calendarDateToUtc(from) : thisMonth.from;
    const end = to ? endOfCalendarDayUtc(to) : thisMonth.to;

    const rows = await timeByClient(user.tenantId ?? "", start, end);
    const clients = await prisma.client.findMany({
      where: {
        id: {
          in: rows.map((row) => row.clientId)
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    const clientMap = new Map(clients.map((client) => [client.id, client.name]));

    return NextResponse.json({
      rows: rows.map((row) => ({
        clientId: row.clientId,
        clientName: clientMap.get(row.clientId) ?? "Unknown client",
        totalHours: (row._sum.durationMinutes ?? 0) / 60
      }))
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed report", 400);
  }
}
