import Link from "next/link";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { prisma } from "@/lib/db";
import { getUserContext } from "@/lib/auth";
import { DateRangePickerField } from "@/components/date-range-picker-field";
import { ExcelFilterField } from "@/components/excel-filter-field";
import { PeriodFilterField } from "@/components/period-filter-field";
import { DashboardTimerRows } from "@/components/dashboard-timer-rows";

type DashboardParams = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  workstreamIds?: string;
  clientIds?: string;
  employeeIds?: string;
  includeInactive?: string;
  billable?: string;
  nonBillable?: string;
};

function getDateRange(
  period: "all" | "this_week" | "last_week" | "this_month" | "last_month" | "custom",
  dateFrom?: string,
  dateTo?: string
) {
  if (period === "all") {
    return null;
  }

  if (period === "custom" && dateFrom && dateTo) {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      return { from, to };
    }
  }

  const now = new Date();
  if (period === "this_week") {
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 })
    };
  }

  if (period === "last_week") {
    const base = subWeeks(now, 1);
    return {
      from: startOfWeek(base, { weekStartsOn: 1 }),
      to: endOfWeek(base, { weekStartsOn: 1 })
    };
  }

  if (period === "this_month") {
    return {
      from: startOfMonth(now),
      to: endOfMonth(now)
    };
  }

  if (period === "last_month") {
    const base = subMonths(now, 1);
    return {
      from: startOfMonth(base),
      to: endOfMonth(base)
    };
  }

  return null;
}

function usd(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits
  }).format(value);
}

function hoursFromMinutes(minutes: number) {
  return minutes / 60;
}

export default async function DashboardPage({
  params,
  searchParams
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<DashboardParams>;
}) {
  const { firmSlug } = await params;
  const query = await searchParams;
  const user = await getUserContext(firmSlug);

  const period =
    query.period === "all" ||
    query.period === "this_week" ||
    query.period === "last_week" ||
    query.period === "this_month" ||
    query.period === "last_month" ||
    query.period === "custom"
      ? query.period
      : "all";
  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";
  const includeInactive = query.includeInactive === "1";
  const showBillable = query.billable !== "0";
  const showNonBillable = query.nonBillable !== "0";
  const dateRange = getDateRange(period, query.dateFrom, query.dateTo);
  const selectedClientIds = (query.clientIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const selectedEmployeeIds = isAdmin
    ? (query.employeeIds ?? "").split(",").map((id) => id.trim()).filter(Boolean)
    : [];
  const selectedWorkstreamIds = (query.workstreamIds ?? "").split(",").map((id) => id.trim()).filter(Boolean);

  const [clients, workstreams, employees] = await Promise.all([
    prisma.client.findMany({
      where: {
        tenantId: user.tenantId ?? "",
        ...(includeInactive ? {} : { status: "active" })
      },
      select: {
        id: true,
        name: true,
        defaultBillingRate: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.workstream.findMany({
      where: {
        tenantId: user.tenantId ?? ""
      },
      select: {
        id: true,
        clientId: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    }),
    prisma.user.findMany({
      where: {
        tenantId: user.tenantId ?? ""
      },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    })
  ]);

  const visibleClientIds = new Set(clients.map((client) => client.id));
  const appliedClientIds = selectedClientIds.length
    ? selectedClientIds.filter((clientId) => visibleClientIds.has(clientId))
    : clients.map((client) => client.id);
  const visibleEmployeeIds = new Set(employees.map((employee) => employee.id));
  const appliedEmployeeIds = selectedEmployeeIds.length
    ? selectedEmployeeIds.filter((employeeId) => visibleEmployeeIds.has(employeeId))
    : [];

  const entries = showBillable || showNonBillable
    ? await prisma.timeEntry.findMany({
        where: {
          tenantId: user.tenantId ?? "",
          deletedAt: null,
          ...(dateRange
            ? {
                date: {
                  gte: dateRange.from,
                  lte: dateRange.to
                }
              }
            : {}),
          ...(selectedWorkstreamIds.length ? { workstreamId: { in: selectedWorkstreamIds } } : {}),
          ...(showBillable && showNonBillable
            ? {}
            : showBillable
              ? { isBillable: true }
              : { isBillable: false }),
          ...(appliedClientIds.length ? { clientId: { in: appliedClientIds } } : { clientId: "" }),
          ...(isAdmin
            ? (appliedEmployeeIds.length ? { userId: { in: appliedEmployeeIds } } : {})
            : { userId: user.id }),
        },
        include: {
          client: true,
          workstream: true,
          user: {
            select: {
              id: true,
              name: true,
              costRate: true
            }
          }
        }
      })
    : [];

  const clientRows = new Map<
    string,
    {
      name: string;
      minutes: number;
      totalBilling: number;
      totalCost: number;
    }
  >();
  const timerRowsByClient = new Map<string, typeof entries>();

  for (const entry of entries) {
    const clientRate = Number(entry.workstream.billingRate ?? entry.client.defaultBillingRate ?? 0);
    const userCostRate = Number(entry.user.costRate ?? 0);
    const hours = hoursFromMinutes(entry.durationMinutes);

    const currentClient = clientRows.get(entry.clientId) ?? {
      name: entry.client.name,
      minutes: 0,
      totalBilling: 0,
      totalCost: 0
    };

    currentClient.minutes += entry.durationMinutes;
    currentClient.totalBilling += entry.isBillable ? hours * clientRate : 0;
    currentClient.totalCost += hours * userCostRate;
    clientRows.set(entry.clientId, currentClient);

    const existingTimers = timerRowsByClient.get(entry.clientId) ?? [];
    existingTimers.push(entry);
    timerRowsByClient.set(entry.clientId, existingTimers);
  }

  const clientTableRows = [...clientRows.entries()].map(([clientId, value]) => {
    const hours = hoursFromMinutes(value.minutes);
    return {
      clientId,
      ...value,
      hours,
      averageBillingRate: hours > 0 ? value.totalBilling / hours : 0,
      averageCost: hours > 0 ? value.totalCost / hours : 0,
      profit: value.totalBilling - value.totalCost
    };
  });
  const topColumnCount = isAdmin ? 7 : 2;
  const topColumnTemplate = isAdmin ? "28% 12% 12% 12% 12% 12% 12%" : "70% 30%";
  const exportParams = new URLSearchParams();
  exportParams.set("firmSlug", firmSlug);
  exportParams.set("period", period);
  if (query.dateFrom) exportParams.set("dateFrom", query.dateFrom);
  if (query.dateTo) exportParams.set("dateTo", query.dateTo);
  if (selectedClientIds.length) exportParams.set("clientIds", selectedClientIds.join(","));
  if (selectedWorkstreamIds.length) exportParams.set("workstreamIds", selectedWorkstreamIds.join(","));
  if (isAdmin && appliedEmployeeIds.length) exportParams.set("employeeIds", appliedEmployeeIds.join(","));
  if (includeInactive) exportParams.set("includeInactive", "1");
  if (!showBillable) exportParams.set("billable", "0");
  if (!showNonBillable) exportParams.set("nonBillable", "0");

  return (
    <main className="space-y-4 px-3">
      <section className="cb-panel p-0">
        <form className="cb-filterbar flex flex-wrap items-center gap-3 p-3" method="GET">
          <ExcelFilterField
            name="clientIds"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            placeholder="Filter clients"
            selected={selectedClientIds}
          />
          {isAdmin ? (
            <ExcelFilterField
              name="employeeIds"
              options={employees.map((employee) => ({ value: employee.id, label: employee.name }))}
              placeholder="Filter employees"
              selected={selectedEmployeeIds}
            />
          ) : null}
          <PeriodFilterField name="period" value={period} />
          <DateRangePickerField
            from={query.dateFrom}
            initialMode={period}
            modeFieldName="period"
            to={query.dateTo}
          />
          <ExcelFilterField
            name="workstreamIds"
            options={workstreams.map((workstream) => ({ value: workstream.id, label: workstream.name }))}
            placeholder="All workstreams"
            selected={selectedWorkstreamIds}
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input defaultChecked={includeInactive} name="includeInactive" type="checkbox" value="1" />
            Display inactive clients
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input defaultChecked={showBillable} name="billable" type="checkbox" value="1" />
            Client Work
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input defaultChecked={showNonBillable} name="nonBillable" type="checkbox" value="1" />
            Firm Work
          </label>
          <Link className="button-secondary" href={`/${firmSlug}/dashboard`}>Reset filters</Link>
        </form>

        <div className="flex justify-end gap-2 px-3 py-2">
          <Link className="button-secondary" href={`/api/export/dashboard-summary.csv?${exportParams.toString()}`}>
            Export Dashboard
          </Link>
          <Link className="button-secondary" href={`/api/export/dashboard-detail.csv?${exportParams.toString()}`}>
            Export Detail
          </Link>
        </div>

        <div className="cb-table-wrap">
          <table className="cb-table">
            <colgroup>
              {isAdmin ? (
                <>
                  <col style={{ width: "28%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                </>
              ) : (
                <>
                  <col style={{ width: "70%" }} />
                  <col style={{ width: "30%" }} />
                </>
              )}
            </colgroup>
            <thead>
              <tr>
                <th>Client</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                {isAdmin ? (
                  <>
                    <th style={{ textAlign: "right" }}>Total Billing</th>
                    <th style={{ textAlign: "right" }}>Average Rate</th>
                    <th style={{ textAlign: "right" }}>Total Cost</th>
                    <th style={{ textAlign: "right" }}>Average Cost</th>
                    <th style={{ textAlign: "right" }}>Profit (Loss)</th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {clientTableRows.map((row) => (
                <tr key={row.clientId}>
                  <td className="p-0" colSpan={topColumnCount}>
                    <details className="group border-b border-[#ede9e1]">
                      <summary
                        className="list-none grid cursor-pointer items-center gap-0 rounded-md px-[14px] py-3 transition-colors hover:bg-[rgba(28,58,40,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#24482f]/25 [&::-webkit-details-marker]:hidden"
                        style={{ gridTemplateColumns: topColumnTemplate }}
                      >
                        <span className="font-medium text-[#1a2e1f]">{row.name}</span>
                        <span className="text-right tabular-nums">{row.hours.toFixed(2)}</span>
                        {isAdmin ? (
                          <>
                            <span className="text-right tabular-nums">{usd(row.totalBilling)}</span>
                            <span className="text-right tabular-nums">{usd(row.averageBillingRate, 2)}</span>
                            <span className="text-right tabular-nums">{usd(row.totalCost)}</span>
                            <span className="text-right tabular-nums">{usd(row.averageCost, 2)}</span>
                            <span className="text-right tabular-nums">{usd(row.profit)}</span>
                          </>
                        ) : null}
                      </summary>
                      <div className="mt-1 rounded-md border border-[#ddd9d0] bg-white p-3 shadow-[0_1px_3px_rgba(20,18,12,0.08)]">
                        <div className="mb-2 text-sm font-semibold text-[#1c3a28]">Timers</div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#ddd9d0] bg-[rgba(28,58,40,0.04)] text-left text-xs uppercase tracking-[0.06em] text-[#4a4a42]">
                                <th className="py-2 pr-3">Date</th>
                                {isAdmin ? <th className="py-2 pr-3">Employee</th> : null}
                                <th className="py-2 pr-3">Workstream</th>
                                <th className="py-2 pr-3">Start</th>
                                <th className="py-2 pr-3">End</th>
                                <th className="py-2 pr-3">Hours</th>
                                <th className="py-2 pr-3">Type</th>
                                <th className="py-2">Notes</th>
                              </tr>
                            </thead>
                            <DashboardTimerRows
                              firmSlug={firmSlug}
                              isAdmin={isAdmin}
                              rows={(timerRowsByClient.get(row.clientId) ?? [])
                                .sort((a, b) => b.date.getTime() - a.date.getTime())
                                .map((timer) => ({
                                  id: timer.id,
                                  dateIso: timer.date.toISOString(),
                                  startTimeIso: timer.startTime ? timer.startTime.toISOString() : null,
                                  endTimeIso: timer.endTime ? timer.endTime.toISOString() : null,
                                  durationMinutes: timer.durationMinutes,
                                  isBillable: timer.isBillable,
                                  notes: timer.notes,
                                  workstreamId: timer.workstreamId,
                                  workstreamName: timer.workstream.name,
                                  userName: timer.user.name
                                }))}
                              workstreams={workstreams
                                .filter((workstream) => workstream.clientId === row.clientId)
                                .map((workstream) => ({ id: workstream.id, name: workstream.name }))}
                            />
                          </table>
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-xs text-[#7a7a70]">Updated {format(new Date(), "MMM d, yyyy h:mm a")}</p>
    </main>
  );
}
