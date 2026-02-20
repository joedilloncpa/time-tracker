import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { getAllowedClientIdsForUser } from "@/lib/tenant-settings";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const body = await request.json();
    const tenantId = user.tenantId ?? "";

    if (!tenantId) {
      return jsonError("Missing tenant context", 400);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settingsJson: true }
    });
    const allowedClientIds = getAllowedClientIdsForUser(tenant?.settingsJson, user.id, user.role);
    if (body.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: body.clientId,
          tenantId,
          status: "active"
        },
        select: { id: true, code: true }
      });
      if (!client) {
        return jsonError("Selected client is inactive or unavailable", 400);
      }
      if (
        allowedClientIds &&
        !allowedClientIds.includes(String(body.clientId)) &&
        client.code !== INTERNAL_FIRM_CLIENT_CODE
      ) {
        return jsonError("You do not have access to this client", 403);
      }
    }

    if (body.workstreamId) {
      const workstream = await prisma.workstream.findFirst({
        where: {
          id: body.workstreamId,
          tenantId,
          status: "active",
          ...(body.clientId ? { clientId: body.clientId } : {})
        },
        select: { id: true }
      });
      if (!workstream) {
        return jsonError("Selected workstream is inactive or unavailable", 400);
      }
    }

    const existing = await prisma.timerSession.findUnique({ where: { userId: user.id } });
    if (existing) {
      return jsonError("Only one active timer is allowed", 409);
    }

    const timer = await prisma.timerSession.create({
      data: {
        tenantId,
        userId: user.id,
        startedAt: new Date(),
        clientId: body.clientId ?? null,
        workstreamId: body.workstreamId ?? null,
        notes: body.notes ?? null
      }
    });

    return NextResponse.json({ timer }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to start timer", 400);
  }
}
