import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { asCsv } from "@/lib/reporting";

export async function GET(request: NextRequest) {
  const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  const entries = await prisma.timeEntry.findMany({
    where: {
      tenantId: user.tenantId ?? "",
      deletedAt: null,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {})
            }
          }
        : {})
    },
    include: {
      client: true,
      workstream: true,
      user: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: {
      date: "desc"
    }
  });

  const csv = asCsv(
    entries.map((entry) => ({
      date: entry.date.toISOString().slice(0, 10),
      team_member: entry.user.name,
      member_email: entry.user.email,
      client: entry.client.name,
      workstream: entry.workstream.name,
      duration_hours: (entry.durationMinutes / 60).toFixed(2),
      billable: entry.isBillable ? "yes" : "no",
      notes: entry.notes ?? ""
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=time-entries.csv"
    }
  });
}
