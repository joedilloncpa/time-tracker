import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueSlug } from "@/lib/slug";
import { ensureFirmWorkArea } from "@/lib/firm-work";
import { jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, firmName } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return jsonError("Name is required");
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return jsonError("Email is required");
    }
    if (!firmName || typeof firmName !== "string" || !firmName.trim()) {
      return jsonError("Firm name is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      return jsonError("An account with this email already exists. Please log in instead.", 409);
    }

    const slug = await generateUniqueSlug(firmName.trim());

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: firmName.trim(),
          slug,
          subscriptionStatus: "free"
        }
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          name: name.trim(),
          role: "firm_admin"
        }
      });

      await ensureFirmWorkArea(tx, tenant.id);

      return { tenant, user };
    });

    return NextResponse.json(
      { tenantSlug: result.tenant.slug, userId: result.user.id },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return jsonError(message, 500);
  }
}
