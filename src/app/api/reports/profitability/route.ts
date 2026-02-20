import { NextRequest, NextResponse } from "next/server";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { canViewCostRates } from "@/lib/permissions";
import { clientProfitability } from "@/lib/reporting";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    if (!canViewCostRates(user)) {
      return jsonError("Forbidden", 403);
    }

    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date();

    const rows = await clientProfitability(user.tenantId ?? "", start, end);
    return NextResponse.json({ rows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed profitability report", 400);
  }
}
