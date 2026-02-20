import { NextRequest, NextResponse } from "next/server";
import { ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");

    const clients = await prisma.client.findMany({
      where: {
        tenantId: user.tenantId ?? "",
        ...(status ? { status: status as ClientStatus } : {}),
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {})
      },
      include: {
        workstreams: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ clients });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load clients", 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const body = await request.json();

    if (!body.name) {
      return jsonError("Client name is required");
    }

    const client = await prisma.client.create({
      data: {
        tenantId: user.tenantId ?? "",
        name: body.name,
        code: body.code ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
        phone: body.phone ?? null,
        industry: body.industry ?? null,
        status: body.status ?? "active",
        notes: body.notes ?? null,
        tags: body.tags ?? [],
        defaultBillingRate: body.defaultBillingRate ?? null,
        budgetHours: body.budgetHours ?? null,
        budgetAmount: body.budgetAmount ?? null,
        qboXeroLink: body.qboXeroLink ?? null
      }
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create client", 400);
  }
}
