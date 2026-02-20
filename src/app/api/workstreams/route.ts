import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const body = await request.json();

    if (!body.clientId || !body.name) {
      return jsonError("clientId and name are required");
    }

    const workstream = await prisma.workstream.create({
      data: {
        tenantId: user.tenantId ?? "",
        clientId: body.clientId,
        name: body.name,
        serviceType: body.serviceType ?? null,
        description: body.description ?? null,
        billingType: body.billingType ?? "hourly",
        billingRate: body.billingRate ?? null,
        fixedFeeAmount: body.fixedFeeAmount ?? null,
        retainerAmount: body.retainerAmount ?? null,
        retainerFrequency: body.retainerFrequency ?? null,
        estimatedHours: body.estimatedHours ?? null,
        status: body.status ?? "active"
      }
    });

    return NextResponse.json({ workstream }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create workstream");
  }
}
