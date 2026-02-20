import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingType, WorkstreamStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserContext } from "@/lib/auth";
import { ensureRole } from "@/lib/permissions";
import { ExcelFilterField } from "@/components/excel-filter-field";
import { assertTenantBySlug } from "@/lib/tenant";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";

type WorkstreamsParams = {
  add?: string;
  includeArchived?: string;
  clientIds?: string;
};

function parseDecimal(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const parsed = new Date(`${text}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

async function resolveTenantContext(firmSlug: string) {
  const [user, tenant] = await Promise.all([
    getUserContext(firmSlug),
    assertTenantBySlug(firmSlug)
  ]);
  return { user, tenantId: tenant.id };
}

async function createWorkstreams(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const name = String(formData.get("name") || "").trim();
  const billingType = String(formData.get("billingType") || "hourly") as BillingType;
  const status = String(formData.get("status") || "active") as WorkstreamStatus;
  const applyToAllClients = formData.get("allClients") === "1";
  const selectedClientIds = String(formData.get("clientIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!name) {
    throw new Error("Workstream name is required");
  }

  let clientIds = selectedClientIds;
  if (applyToAllClients) {
    const clients = await prisma.client.findMany({
      where: {
        tenantId,
        OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
      },
      select: { id: true }
    });
    clientIds = clients.map((client) => client.id);
  }

  if (clientIds.length === 0) {
    throw new Error("Select at least one client or enable all clients");
  }

  const billingRate = parseDecimal(formData.get("billingRate"));
  await prisma.workstream.createMany({
    data: clientIds.map((clientId) => ({
      tenantId,
      clientId,
      name,
      billingType,
      billingRate,
      status
    }))
  });

  revalidatePath(`/${firmSlug}/workstreams`);
  redirect(`/${firmSlug}/workstreams`);
}

async function updateWorkstreamGroup(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamIds = String(formData.get("workstreamIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const name = String(formData.get("name") || "").trim();
  const billingTypeRaw = String(formData.get("billingType") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const clearRate = formData.get("clearRate") === "1";
  const rateRaw = String(formData.get("billingRate") || "").trim();
  const serviceTypeRaw = String(formData.get("serviceType") || "").trim();
  const clearServiceType = formData.get("clearServiceType") === "1";
  const descriptionRaw = String(formData.get("description") || "").trim();
  const clearDescription = formData.get("clearDescription") === "1";
  const fixedFeeAmountRaw = String(formData.get("fixedFeeAmount") || "").trim();
  const clearFixedFeeAmount = formData.get("clearFixedFeeAmount") === "1";
  const retainerAmountRaw = String(formData.get("retainerAmount") || "").trim();
  const clearRetainerAmount = formData.get("clearRetainerAmount") === "1";
  const retainerFrequencyRaw = String(formData.get("retainerFrequency") || "").trim();
  const clearRetainerFrequency = formData.get("clearRetainerFrequency") === "1";
  const estimatedHoursRaw = String(formData.get("estimatedHours") || "").trim();
  const clearEstimatedHours = formData.get("clearEstimatedHours") === "1";
  const startDateRaw = String(formData.get("startDate") || "").trim();
  const clearStartDate = formData.get("clearStartDate") === "1";
  const endDateRaw = String(formData.get("endDate") || "").trim();
  const clearEndDate = formData.get("clearEndDate") === "1";
  const includeArchived = String(formData.get("includeArchived") || "") === "1";
  const selectedClientIds = String(formData.get("selectedClientIds") || "");

  if (!workstreamIds.length || !name) {
    throw new Error("Workstream ids and name are required");
  }

  const data: {
    name: string;
    billingType?: BillingType;
    status?: WorkstreamStatus;
    billingRate?: number | null;
    serviceType?: string | null;
    description?: string | null;
    fixedFeeAmount?: number | null;
    retainerAmount?: number | null;
    retainerFrequency?: string | null;
    estimatedHours?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } = { name };

  if (billingTypeRaw === "hourly" || billingTypeRaw === "fixed" || billingTypeRaw === "retainer") {
    data.billingType = billingTypeRaw;
  }
  if (statusRaw === "active" || statusRaw === "paused" || statusRaw === "complete" || statusRaw === "archived") {
    data.status = statusRaw;
  }

  if (clearRate) {
    data.billingRate = null;
  } else if (rateRaw !== "") {
    const parsedRate = parseDecimal(rateRaw);
    if (parsedRate === null) {
      throw new Error("Billing rate must be a valid number");
    }
    data.billingRate = parsedRate;
  }
  if (clearServiceType) {
    data.serviceType = null;
  } else if (serviceTypeRaw !== "") {
    data.serviceType = serviceTypeRaw;
  }
  if (clearDescription) {
    data.description = null;
  } else if (descriptionRaw !== "") {
    data.description = descriptionRaw;
  }
  if (clearFixedFeeAmount) {
    data.fixedFeeAmount = null;
  } else if (fixedFeeAmountRaw !== "") {
    data.fixedFeeAmount = parseDecimal(fixedFeeAmountRaw);
  }
  if (clearRetainerAmount) {
    data.retainerAmount = null;
  } else if (retainerAmountRaw !== "") {
    data.retainerAmount = parseDecimal(retainerAmountRaw);
  }
  if (clearRetainerFrequency) {
    data.retainerFrequency = null;
  } else if (retainerFrequencyRaw !== "") {
    data.retainerFrequency = retainerFrequencyRaw;
  }
  if (clearEstimatedHours) {
    data.estimatedHours = null;
  } else if (estimatedHoursRaw !== "") {
    data.estimatedHours = parseDecimal(estimatedHoursRaw);
  }
  if (clearStartDate) {
    data.startDate = null;
  } else if (startDateRaw !== "") {
    data.startDate = parseDate(startDateRaw);
  }
  if (clearEndDate) {
    data.endDate = null;
  } else if (endDateRaw !== "") {
    data.endDate = parseDate(endDateRaw);
  }

  await prisma.workstream.updateMany({
    where: { id: { in: workstreamIds }, tenantId },
    data
  });

  revalidatePath(`/${firmSlug}/workstreams`);
  const query = new URLSearchParams();
  if (includeArchived) {
    query.set("includeArchived", "1");
  }
  if (selectedClientIds) {
    query.set("clientIds", selectedClientIds);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/${firmSlug}/workstreams${suffix}`);
}

async function updateSingleWorkstream(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamId = String(formData.get("workstreamId") || "");
  const name = String(formData.get("name") || "").trim();
  const clientId = String(formData.get("clientId") || "");
  const billingType = String(formData.get("billingType") || "hourly") as BillingType;
  const status = String(formData.get("status") || "active") as WorkstreamStatus;
  const includeArchived = String(formData.get("includeArchived") || "") === "1";
  const selectedClientIds = String(formData.get("selectedClientIds") || "");

  if (!workstreamId || !name || !clientId) {
    throw new Error("Workstream, name, and client are required");
  }

  await prisma.workstream.updateMany({
    where: { id: workstreamId, tenantId },
    data: {
      name,
      clientId,
      billingType,
      status,
      billingRate: parseDecimal(formData.get("billingRate")),
      serviceType: String(formData.get("serviceType") || "").trim() || null,
      description: String(formData.get("description") || "").trim() || null,
      fixedFeeAmount: parseDecimal(formData.get("fixedFeeAmount")),
      retainerAmount: parseDecimal(formData.get("retainerAmount")),
      retainerFrequency: String(formData.get("retainerFrequency") || "").trim() || null,
      estimatedHours: parseDecimal(formData.get("estimatedHours")),
      startDate: parseDate(formData.get("startDate")),
      endDate: parseDate(formData.get("endDate"))
    }
  });

  revalidatePath(`/${firmSlug}/workstreams`);
  const query = new URLSearchParams();
  if (includeArchived) {
    query.set("includeArchived", "1");
  }
  if (selectedClientIds) {
    query.set("clientIds", selectedClientIds);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  redirect(`/${firmSlug}/workstreams${suffix}`);
}

export default async function WorkstreamsPage({
  params,
  searchParams
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<WorkstreamsParams>;
}) {
  const { firmSlug } = await params;
  const query = await searchParams;
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";
  const openCreate = query.add === "1";
  const includeArchived = query.includeArchived === "1";
  const selectedClientIds = (query.clientIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const clients = await prisma.client.findMany({
    where: {
      tenantId,
      OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });

  const defaultWorkstreams = await prisma.workstream.findMany({
    where: {
      tenantId,
      client: {
        OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
      },
      ...(includeArchived ? {} : { status: { not: "archived" } }),
      ...(selectedClientIds.length ? { clientId: { in: selectedClientIds } } : {})
    },
    include: {
      client: {
        select: { id: true, name: true }
      }
    },
    orderBy: [{ name: "asc" }, { client: { name: "asc" } }]
  });
  const fallbackWorkstreams =
    !includeArchived && defaultWorkstreams.length === 0
      ? await prisma.workstream.findMany({
          where: {
            tenantId,
            client: {
              OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
            },
            ...(selectedClientIds.length ? { clientId: { in: selectedClientIds } } : {})
          },
          include: {
            client: {
              select: { id: true, name: true }
            }
          },
          orderBy: [{ name: "asc" }, { client: { name: "asc" } }]
        })
      : [];
  const workstreams = fallbackWorkstreams.length > 0 ? fallbackWorkstreams : defaultWorkstreams;
  const workstreamGroups = Array.from(
    workstreams.reduce<
      Map<
        string,
        {
          name: string;
          rows: typeof workstreams;
          clientNames: string[];
        }
      >
    >((map, workstream) => {
      const key = workstream.name.trim().toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(workstream);
        if (!existing.clientNames.includes(workstream.client.name)) {
          existing.clientNames.push(workstream.client.name);
        }
      } else {
        map.set(key, {
          name: workstream.name,
          rows: [workstream],
          clientNames: [workstream.client.name]
        });
      }
      return map;
    }, new Map())
      .values()
  )
    .map((group) => ({
      ...group,
      clientNames: group.clientNames.sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-center gap-3 pl-2 md:pl-4">
        <h1 className="text-2xl font-semibold text-brand-900">Workstreams</h1>
        {isAdmin ? (
          <Link className="button" href={`/${firmSlug}/workstreams?add=1`}>
            New Workstream
          </Link>
        ) : null}
      </section>

      <section className="card ml-2 w-full max-w-6xl space-y-3 md:ml-4">
        {!includeArchived && fallbackWorkstreams.length > 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No active/paused/complete workstreams were found, so archived workstreams are shown.
          </p>
        ) : null}
        <form className="flex flex-wrap items-center gap-3" method="GET">
          <ExcelFilterField
            name="clientIds"
            options={clients.map((client) => ({ value: client.id, label: client.name }))}
            placeholder="Filter clients"
            selected={selectedClientIds}
          />
          <label className="inline-flex items-center gap-2 text-sm text-[#1a2e1f]">
            <input defaultChecked={includeArchived} name="includeArchived" type="checkbox" value="1" />
            Include archived
          </label>
          <button className="button-secondary px-3" type="submit">Apply</button>
        </form>

        <ul className="space-y-3">
          {workstreamGroups.length === 0 ? (
            <li className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-4 text-sm text-[#7a7a70]">
              No workstreams found.
            </li>
          ) : null}
          {workstreamGroups.map((group) => {
            const billingTypes = uniqueValues(group.rows.map((row) => row.billingType));
            const statuses = uniqueValues(group.rows.map((row) => row.status));
            const rates = uniqueValues(group.rows.map((row) => (row.billingRate == null ? null : Number(row.billingRate))));
            const sharedBillingType = billingTypes.length === 1 ? billingTypes[0] : "";
            const sharedStatus = statuses.length === 1 ? statuses[0] : "";
            const sharedRate = rates.length === 1 ? rates[0] : undefined;

            return (
              <li key={group.name} className="rounded-lg border border-[#ddd9d0] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#1a2e1f]">{group.name}</p>
                  <p className="text-sm text-[#7a7a70]">
                    Used by {group.clientNames.length} client{group.clientNames.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#7a7a70]">
                  <span>{sharedStatus || "mixed status"}</span>
                  <span>•</span>
                  <span>{sharedBillingType || "mixed billing type"}</span>
                  <span>•</span>
                  <span>
                    {sharedRate === undefined ? "mixed rates" : sharedRate == null ? "No rate" : `$${Number(sharedRate).toFixed(2)}/hr`}
                  </span>
                </div>
              </div>
              <details className="mt-2">
                <summary className="button-secondary w-fit cursor-pointer px-3 py-2 text-sm">
                  Clients ({group.clientNames.length})
                </summary>
                <ul className="mt-2 rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3 text-sm text-[#4a4a42]">
                  {group.clientNames.map((clientName) => (
                    <li key={`${group.name}-${clientName}`}>{clientName}</li>
                  ))}
                </ul>
              </details>

              {isAdmin ? (
                <form action={updateWorkstreamGroup} className="mt-3 grid gap-3 rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3 md:grid-cols-3">
                  <input name="firmSlug" type="hidden" value={firmSlug} />
                  <input name="workstreamIds" type="hidden" value={group.rows.map((row) => row.id).join(",")} />
                  <input name="includeArchived" type="hidden" value={includeArchived ? "1" : "0"} />
                  <input name="selectedClientIds" type="hidden" value={selectedClientIds.join(",")} />
                  <input className="input" defaultValue={group.name} name="name" placeholder="Workstream name" required />
                  <input
                    className="input"
                    defaultValue={sharedRate == null || sharedRate === undefined ? "" : Number(sharedRate).toString()}
                    name="billingRate"
                    placeholder={sharedRate === undefined ? "Mixed rates (set new rate)" : "Billing rate"}
                    step="0.01"
                    type="number"
                  />
                  <select className="input" defaultValue={sharedBillingType} name="billingType">
                    <option value="">Keep existing billing types</option>
                    <option value="hourly">hourly</option>
                    <option value="fixed">fixed</option>
                    <option value="retainer">retainer</option>
                  </select>
                  <select className="input" defaultValue={sharedStatus} name="status">
                    <option value="">Keep existing statuses</option>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="complete">complete</option>
                    <option value="archived">archived</option>
                  </select>
                  <input className="input" name="serviceType" placeholder="Service type (optional)" />
                  <input className="input md:col-span-2" name="description" placeholder="Description (optional)" />
                  <input className="input" name="fixedFeeAmount" placeholder="Fixed fee amount" step="0.01" type="number" />
                  <input className="input" name="retainerAmount" placeholder="Retainer amount" step="0.01" type="number" />
                  <input className="input" name="retainerFrequency" placeholder="Retainer frequency" />
                  <input className="input" name="estimatedHours" placeholder="Estimated hours" step="0.01" type="number" />
                  <input className="input" name="startDate" type="date" />
                  <input className="input" name="endDate" type="date" />
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearRate" type="checkbox" value="1" />
                    Clear rates for all clients
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearServiceType" type="checkbox" value="1" />
                    Clear service type
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearDescription" type="checkbox" value="1" />
                    Clear description
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearFixedFeeAmount" type="checkbox" value="1" />
                    Clear fixed fee
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearRetainerAmount" type="checkbox" value="1" />
                    Clear retainer amount
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearRetainerFrequency" type="checkbox" value="1" />
                    Clear retainer frequency
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearEstimatedHours" type="checkbox" value="1" />
                    Clear estimated hours
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearStartDate" type="checkbox" value="1" />
                    Clear start date
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                    <input name="clearEndDate" type="checkbox" value="1" />
                    Clear end date
                  </label>
                  <button className="button md:justify-self-end" type="submit">Save all client rows</button>
                </form>
              ) : null}
              {isAdmin ? (
                <div className="mt-3 space-y-2 rounded-lg border border-[#ddd9d0] bg-white p-3">
                  {group.rows
                    .sort((a, b) => a.client.name.localeCompare(b.client.name))
                    .map((row) => (
                      <details key={row.id}>
                        <summary className="cursor-pointer text-sm font-medium text-[#1a2e1f]">
                          Edit {row.client.name}
                        </summary>
                        <form action={updateSingleWorkstream} className="mt-2 grid gap-2 rounded-md border border-[#ede9e1] bg-[#f7f4ef] p-3 md:grid-cols-3">
                          <input name="firmSlug" type="hidden" value={firmSlug} />
                          <input name="workstreamId" type="hidden" value={row.id} />
                          <input name="includeArchived" type="hidden" value={includeArchived ? "1" : "0"} />
                          <input name="selectedClientIds" type="hidden" value={selectedClientIds.join(",")} />
                          <input className="input" defaultValue={row.name} name="name" required />
                          <select className="input" defaultValue={row.clientId} name="clientId">
                            {clients.map((client) => (
                              <option key={`${row.id}-${client.id}`} value={client.id}>{client.name}</option>
                            ))}
                          </select>
                          <input
                            className="input"
                            defaultValue={row.billingRate == null ? "" : Number(row.billingRate).toString()}
                            name="billingRate"
                            placeholder="Billing rate"
                            step="0.01"
                            type="number"
                          />
                          <select className="input" defaultValue={row.billingType} name="billingType">
                            <option value="hourly">hourly</option>
                            <option value="fixed">fixed</option>
                            <option value="retainer">retainer</option>
                          </select>
                          <select className="input" defaultValue={row.status} name="status">
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="complete">complete</option>
                            <option value="archived">archived</option>
                          </select>
                          <input className="input" defaultValue={row.serviceType ?? ""} name="serviceType" placeholder="Service type" />
                          <input className="input md:col-span-3" defaultValue={row.description ?? ""} name="description" placeholder="Description" />
                          <input className="input" defaultValue={row.fixedFeeAmount == null ? "" : Number(row.fixedFeeAmount).toString()} name="fixedFeeAmount" placeholder="Fixed fee amount" step="0.01" type="number" />
                          <input className="input" defaultValue={row.retainerAmount == null ? "" : Number(row.retainerAmount).toString()} name="retainerAmount" placeholder="Retainer amount" step="0.01" type="number" />
                          <input className="input" defaultValue={row.retainerFrequency ?? ""} name="retainerFrequency" placeholder="Retainer frequency" />
                          <input className="input" defaultValue={row.estimatedHours == null ? "" : Number(row.estimatedHours).toString()} name="estimatedHours" placeholder="Estimated hours" step="0.01" type="number" />
                          <input className="input" defaultValue={row.startDate ? row.startDate.toISOString().slice(0, 10) : ""} name="startDate" type="date" />
                          <input className="input" defaultValue={row.endDate ? row.endDate.toISOString().slice(0, 10) : ""} name="endDate" type="date" />
                          <button className="button md:justify-self-end" type="submit">Save {row.client.name}</button>
                        </form>
                      </details>
                    ))}
                </div>
              ) : null}
            </li>
            );
          })}
        </ul>
      </section>

      {isAdmin && openCreate ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(20,18,12,0.25)] p-6 pt-16">
          <div className="w-full max-w-3xl rounded-2xl border border-[#ddd9d0] bg-white shadow-[0_8px_32px_rgba(20,18,12,0.16)]">
            <div className="border-b border-[#ddd9d0] px-6 py-4">
              <h2 className="cb-display text-3xl text-[#1a2e1f]">New Workstream</h2>
            </div>
            <form action={createWorkstreams} className="grid gap-3 p-6 md:grid-cols-2">
              <input name="firmSlug" type="hidden" value={firmSlug} />
              <label className="text-sm text-[#4a4a42]">Name</label>
              <input className="input md:col-span-2" name="name" placeholder="Workstream name" required />
              <label className="text-sm text-[#4a4a42]">Applies to Clients</label>
              <div className="md:col-span-2">
                <ExcelFilterField
                  autoSubmit={false}
                  name="clientIds"
                  options={clients.map((client) => ({ value: client.id, label: client.name }))}
                  placeholder="Select clients"
                  selected={[]}
                />
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-[#1a2e1f]">
                  <input name="allClients" type="checkbox" value="1" />
                  Apply to all clients
                </label>
              </div>
              <label className="text-sm text-[#4a4a42]">Billing Type</label>
              <select className="input" defaultValue="hourly" name="billingType">
                <option value="hourly">hourly</option>
                <option value="fixed">fixed</option>
                <option value="retainer">retainer</option>
              </select>
              <label className="text-sm text-[#4a4a42]">Billing Rate</label>
              <input className="input" name="billingRate" placeholder="Optional rate" step="0.01" type="number" />
              <label className="text-sm text-[#4a4a42]">Status</label>
              <select className="input" defaultValue="active" name="status">
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="complete">complete</option>
                <option value="archived">archived</option>
              </select>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Link className="button-secondary" href={`/${firmSlug}/workstreams`}>Cancel</Link>
                <button className="button" type="submit">Create workstream</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
