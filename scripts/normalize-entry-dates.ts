/**
 * One-off backfill: rewrite TimeEntry.date to the canonical UTC midnight of the
 * calendar date the entry belongs to, interpreted in the owning firm's timezone.
 *
 * Historic rows were written three different ways - UTC midnight (old Add Timer),
 * local midnight shifted into UTC (dashboard inline edit), and a full instant
 * (timer stop) - which is why locked periods and billing months could disagree
 * with the date shown on the dashboard.
 *
 * Dry run (default):  npx tsx scripts/normalize-entry-dates.ts
 * Apply:              npx tsx scripts/normalize-entry-dates.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_TIME_ZONE, startOfCalendarDayUtc, utcToCalendarDate } from "../src/lib/calendar-date";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, timezone: true } });
  let changed = 0;
  let scanned = 0;

  for (const tenant of tenants) {
    const timeZone = tenant.timezone || DEFAULT_TIME_ZONE;
    const entries = await prisma.timeEntry.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, date: true, startTime: true }
    });

    for (const entry of entries) {
      scanned += 1;
      // Prefer startTime when present: it is a true instant, so it names the
      // working day unambiguously. Otherwise fall back to the stored date.
      const source = entry.startTime ?? entry.date;
      const normalized = startOfCalendarDayUtc(source, timeZone);
      if (normalized.getTime() === entry.date.getTime()) {
        continue;
      }

      changed += 1;
      console.log(
        `${tenant.name}: ${entry.id} ${entry.date.toISOString()} -> ${utcToCalendarDate(normalized)}`
      );
      if (apply) {
        await prisma.timeEntry.update({ where: { id: entry.id }, data: { date: normalized } });
      }
    }
  }

  console.log(`\nScanned ${scanned} entries; ${changed} need normalizing.`);
  console.log(apply ? "Applied." : "Dry run - re-run with --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
