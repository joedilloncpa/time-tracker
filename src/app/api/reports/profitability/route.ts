import { NextRequest, NextResponse } from "next/server";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { canViewCostRates } from "@/lib/permissions";
import { clientProfitability } from "@/lib/reporting";
import { jsonError } from "@/lib/http";
import { calendarDateToUtc, endOfCalendarDayUtc, resolveDateRange } from "@/lib/calendar-date";
import { getTenantTimeZone } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    if (!canViewCostRates(user)) {
      return jsonError("Forbidden", 403);
    }

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    const timeZone = await getTenantTimeZone(user.tenantId);
    const thisMonth = resolveDateRange("this_month", null, null, timeZone)!;
    const start = from ? calendarDateToUtc(from) : thisMonth.from;
    const end = to ? endOfCalendarDayUtc(to) : thisMonth.to;

    const rows = await clientProfitability(user.tenantId ?? "", start, end);
    return NextResponse.json({ rows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed profitability report", 400);
  }
}
