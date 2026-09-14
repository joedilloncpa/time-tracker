import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiContextFromSearchParams } from "@/lib/api-context";
import { jsonError } from "@/lib/http";

/**
 * Cheap "is my timer still real?" check. The header renders activeTimer from a
 * server render and then counts up in the browser, so a tab that has been open
 * a while can show a timer that was stopped elsewhere - and its stop button
 * then 404s forever. The client polls this to reconcile.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getApiContextFromSearchParams(request.nextUrl.searchParams);
    const timer = await prisma.timerSession.findUnique({
      where: { userId: user.id },
      select: { id: true }
    });
    return NextResponse.json({ activeTimerId: timer?.id ?? null });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to read timer status", 400);
  }
}
