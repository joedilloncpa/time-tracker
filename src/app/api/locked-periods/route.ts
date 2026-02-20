import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureRole } from "@/lib/permissions";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const rows = await prisma.lockedPeriod.findMany({
      where: {
        tenantId: user.tenantId ?? ""
      },
      orderBy: [
        { periodYear: "desc" },
        { periodMonth: "desc" }
      ]
    });

    return NextResponse.json({ periods: rows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load periods", 400);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    ensureRole(user, ["firm_admin", "super_admin"]);

    const body = await request.json();
    const periodYear = Number(body.periodYear);
    const periodMonth = Number(body.periodMonth);

    if (!periodYear || !periodMonth) {
      return jsonError("periodYear and periodMonth are required");
    }

    const period = await prisma.lockedPeriod.upsert({
      where: {
        tenantId_periodYear_periodMonth: {
          tenantId: user.tenantId ?? "",
          periodYear,
          periodMonth
        }
      },
      create: {
        tenantId: user.tenantId ?? "",
        periodYear,
        periodMonth,
        lockedByUserId: user.id
      },
      update: {
        lockedAt: new Date(),
        lockedByUserId: user.id,
        unlockedAt: null,
        unlockedByUserId: null
      }
    });

    return NextResponse.json({ period }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to lock period", 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    ensureRole(user, ["firm_admin", "super_admin"]);

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return jsonError("id is required");
    }

    const period = await prisma.lockedPeriod.update({
      where: { id },
      data: {
        unlockedAt: new Date(),
        unlockedByUserId: user.id
      }
    });

    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId ?? "",
        userId: user.id,
        action: "period_unlock",
        entityType: "LockedPeriod",
        entityId: id
      }
    });

    return NextResponse.json({ period });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to unlock period", 400);
  }
}
