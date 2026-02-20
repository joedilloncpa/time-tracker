import { NextRequest, NextResponse } from "next/server";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { timeByClient } from "@/lib/reporting";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date();

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
