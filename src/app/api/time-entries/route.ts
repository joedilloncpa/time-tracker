import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureRole } from "@/lib/permissions";
import { assertPeriodUnlocked, parseDurationMinutes, validateTimeRange } from "@/lib/time-validation";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { getAllowedClientIdsForUser } from "@/lib/tenant-settings";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const teamMemberId = request.nextUrl.searchParams.get("teamMemberId");
    const isAdmin = user.role === "firm_admin" || user.role === "super_admin";

    let scopedTeamMemberId: string | null = null;
    if (teamMemberId) {
      if (!isAdmin) {
        return jsonError("Only admins can filter by team member", 403);
      }
      const member = await prisma.user.findFirst({
        where: {
          id: teamMemberId,
          tenantId: user.tenantId ?? ""
        },
        select: { id: true }
      });
      if (!member) {
        return jsonError("Selected team member is unavailable", 400);
      }
      scopedTeamMemberId = member.id;
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId: user.tenantId ?? "",
        deletedAt: null,
        user: { tenantId: user.tenantId ?? "" },
        ...(scopedTeamMemberId ? { userId: scopedTeamMemberId } : {}),
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
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        date: "desc"
      }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load time entries", 400);
  }
}

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
    const date = new Date(body.date);
    await assertPeriodUnlocked(user.tenantId ?? "", date);

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

    const workstream = await prisma.workstream.findFirst({
      where: {
        id: body.workstreamId,
        tenantId,
        clientId: body.clientId,
        status: "active"
      },
      select: { id: true }
    });
    if (!workstream) {
      return jsonError("Selected workstream is inactive or unavailable", 400);
    }

    const startTime = body.startTime ? new Date(body.startTime) : undefined;
    const endTime = body.endTime ? new Date(body.endTime) : undefined;
    validateTimeRange(startTime, endTime);

    const durationMinutes = body.durationMinutes
      ? Number(body.durationMinutes)
      : parseDurationMinutes(String(body.duration || ""));

    const entry = await prisma.timeEntry.create({
      data: {
        tenantId,
        userId: user.id,
        clientId: body.clientId,
        workstreamId: body.workstreamId,
        date,
        startTime,
        endTime,
        durationMinutes,
        isBillable: body.isBillable ?? true,
        notes: body.notes ?? null,
        tags: body.tags ?? []
      }
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create time entry", 400);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const body = await request.json();

    if (!Array.isArray(body.entryIds) || body.entryIds.length === 0) {
      return jsonError("entryIds are required");
    }

    if (!body.patch || typeof body.patch !== "object") {
      return jsonError("patch object is required");
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId: user.tenantId ?? "",
        id: { in: body.entryIds },
        deletedAt: null
      }
    });

    for (const entry of entries) {
      if (entry.userId !== user.id) {
        ensureRole(user, ["firm_admin", "super_admin"]);
      }
      await assertPeriodUnlocked(user.tenantId ?? "", entry.date);
    }
    const patch = body.patch as Record<string, unknown>;
    const patchData: {
      clientId?: string;
      workstreamId?: string;
      isBillable?: boolean;
      notes?: string | null;
      date?: Date;
      startTime?: Date | null;
      endTime?: Date | null;
      durationMinutes?: number;
    } = {};

    if (typeof patch.clientId === "string" && patch.clientId.trim()) {
      patchData.clientId = patch.clientId;
    }
    if (typeof patch.workstreamId === "string" && patch.workstreamId.trim()) {
      patchData.workstreamId = patch.workstreamId;
    }
    if (typeof patch.isBillable === "boolean") {
      patchData.isBillable = patch.isBillable;
    }
    if (patch.notes === null) {
      patchData.notes = null;
    } else if (typeof patch.notes === "string") {
      patchData.notes = patch.notes.trim() || null;
    }
    if (typeof patch.date === "string" && patch.date.trim()) {
      const parsedDate = new Date(patch.date);
      if (Number.isNaN(parsedDate.getTime())) {
        return jsonError("Invalid date");
      }
      patchData.date = parsedDate;
      await assertPeriodUnlocked(user.tenantId ?? "", parsedDate);
    }
    if (patch.startTime === null) {
      patchData.startTime = null;
    } else if (typeof patch.startTime === "string" && patch.startTime.trim()) {
      const parsed = new Date(patch.startTime);
      if (Number.isNaN(parsed.getTime())) {
        return jsonError("Invalid startTime");
      }
      patchData.startTime = parsed;
    }
    if (patch.endTime === null) {
      patchData.endTime = null;
    } else if (typeof patch.endTime === "string" && patch.endTime.trim()) {
      const parsed = new Date(patch.endTime);
      if (Number.isNaN(parsed.getTime())) {
        return jsonError("Invalid endTime");
      }
      patchData.endTime = parsed;
    }
    if (patch.durationMinutes != null) {
      const durationMinutes = Number(patch.durationMinutes);
      if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
        return jsonError("Invalid durationMinutes");
      }
      patchData.durationMinutes = Math.round(durationMinutes);
    }

    validateTimeRange(patchData.startTime ?? undefined, patchData.endTime ?? undefined);

    if (
      patchData.durationMinutes == null &&
      patchData.startTime instanceof Date &&
      patchData.endTime instanceof Date
    ) {
      patchData.durationMinutes = Math.max(
        1,
        Math.round((patchData.endTime.getTime() - patchData.startTime.getTime()) / 60000)
      );
    }

    for (const entry of entries) {
      const targetClientId = patchData.clientId ?? entry.clientId;
      if (patchData.workstreamId) {
        const workstream = await prisma.workstream.findFirst({
          where: {
            id: patchData.workstreamId,
            tenantId: user.tenantId ?? "",
            clientId: targetClientId,
            status: "active"
          },
          select: { id: true }
        });
        if (!workstream) {
          return jsonError("Selected workstream is unavailable for this client", 400);
        }
      }
    }

    const updates = await Promise.all(
      entries.map((entry) =>
        prisma.timeEntry.update({
          where: { id: entry.id },
          data: patchData
        })
      )
    );

    return NextResponse.json({ updated: updates.length });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed bulk update", 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return jsonError("id is required");
    }

    const entry = await prisma.timeEntry.findFirst({
      where: {
        id,
        tenantId: user.tenantId ?? "",
        deletedAt: null
      }
    });

    if (!entry) {
      return jsonError("Entry not found", 404);
    }

    if (entry.userId !== user.id) {
      ensureRole(user, ["firm_admin", "super_admin"]);
    }

    await assertPeriodUnlocked(user.tenantId ?? "", entry.date);

    await prisma.timeEntry.update({
      where: {
        id
      },
      data: {
        deletedAt: new Date()
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to delete entry", 400);
  }
}
