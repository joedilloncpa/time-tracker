import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPeriodUnlocked } from "@/lib/time-validation";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const body = await request.json();

    const timer = await prisma.timerSession.findUnique({ where: { userId: user.id } });
    if (!timer) {
      return jsonError("No active timer", 404);
    }

    const now = new Date();
    await assertPeriodUnlocked(user.tenantId ?? "", now);

    const durationMinutes = Math.max(1, Math.round((now.getTime() - timer.startedAt.getTime()) / 60000));

    const clientId = body.clientId ?? timer.clientId;
    const workstreamId = body.workstreamId ?? timer.workstreamId;

    if (!clientId || !workstreamId) {
      return jsonError("clientId and workstreamId are required to stop timer");
    }

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        tenantId: user.tenantId ?? ""
      },
      select: {
        code: true
      }
    });

    const entry = await prisma.timeEntry.create({
      data: {
        tenantId: user.tenantId ?? "",
        userId: user.id,
        clientId,
        workstreamId,
        date: now,
        durationMinutes,
        isBillable: client?.code === INTERNAL_FIRM_CLIENT_CODE ? false : true,
        notes: body.notes ?? timer.notes ?? null,
        tags: []
      }
    });

    await prisma.timerSession.delete({ where: { userId: user.id } });

    return NextResponse.json({ entry });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to stop timer", 400);
  }
}
