import { prisma } from "@/lib/db";

export function parseDurationMinutes(input: string): number {
  const normalized = input.trim();
  if (normalized.includes(":")) {
    const [hoursText, minsText] = normalized.split(":");
    const hours = Number(hoursText);
    const mins = Number(minsText);
    if (Number.isNaN(hours) || Number.isNaN(mins)) {
      throw new Error("Invalid duration format");
    }
    return hours * 60 + mins;
  }

  const asNumber = Number(normalized);
  if (Number.isNaN(asNumber)) {
    throw new Error("Invalid duration format");
  }
  return Math.round(asNumber * 60);
}

export function warnOnDuration(durationMinutes: number) {
  if (durationMinutes > 24 * 60) {
    return "Entry exceeds 24 hours";
  }
  return null;
}

export function detectWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export async function assertPeriodUnlocked(tenantId: string, date: Date) {
  const periodYear = date.getUTCFullYear();
  const periodMonth = date.getUTCMonth() + 1;

  const locked = await prisma.lockedPeriod.findFirst({
    where: {
      tenantId,
      periodYear,
      periodMonth,
      unlockedAt: null
    }
  });

  if (locked) {
    throw new Error("This period is locked. Time entries cannot be changed.");
  }
}

export function validateTimeRange(startTime?: Date, endTime?: Date) {
  if (!startTime || !endTime) {
    return;
  }

  if (endTime <= startTime) {
    throw new Error("End time must be after start time");
  }
}
