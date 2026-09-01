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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const apply = process.argv.includes("--apply");

/**
 * Supabase's transaction pooler (port 6543) rejects the prepared statements
 * Prisma issues by default, so ask for pgbouncer mode explicitly.
 */
function poolerSafeUrl() {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw || raw.includes("pgbouncer=")) {
    return raw;
  }
  const separator = raw.includes("?") ? "&" : "?";
  return `${raw}${separator}pgbouncer=true&connection_limit=1`;
}

const prisma = new PrismaClient({ datasources: { db: { url: poolerSafeUrl() } } });

/** A value already stored the canonical way carries no time-of-day. */
function isCanonical(date: Date) {
  return date.getTime() % MS_PER_DAY === 0;
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true, timezone: true } });
  const counts = { fromStartTime: 0, fromInstantDate: 0, alreadyCanonical: 0 };
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

      // startTime is a true instant, so it names the working day unambiguously.
      // Without one, a date already at UTC midnight is a calendar date that just
      // needs leaving alone - reinterpreting it in a timezone would walk it back
      // a day. Anything else is an instant and converts like startTime.
      let normalized: Date;
      if (entry.startTime) {
        normalized = startOfCalendarDayUtc(entry.startTime, timeZone);
        counts.fromStartTime += 1;
      } else if (isCanonical(entry.date)) {
        counts.alreadyCanonical += 1;
        continue;
      } else {
        normalized = startOfCalendarDayUtc(entry.date, timeZone);
        counts.fromInstantDate += 1;
      }

      if (normalized.getTime() === entry.date.getTime()) {
        continue;
      }

      changed += 1;
      const moved = utcToCalendarDate(normalized) !== entry.date.toISOString().slice(0, 10);
      console.log(
        `${moved ? "MOVED " : "canon "} ${tenant.name}: ${entry.id} ` +
          `${entry.date.toISOString()} -> ${utcToCalendarDate(normalized)}`
      );
      if (apply) {
        await prisma.timeEntry.update({ where: { id: entry.id }, data: { date: normalized } });
      }
    }
  }

  console.log(`\nScanned ${scanned} entries; ${changed} to rewrite.`);
  console.log(`  source: startTime=${counts.fromStartTime} instant-date=${counts.fromInstantDate} left-alone=${counts.alreadyCanonical}`);
  console.log(apply ? "Applied." : "Dry run - re-run with --apply to write.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
