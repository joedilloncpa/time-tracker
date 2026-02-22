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
import { FormSubmitButton } from "@/components/form-submit-button";

type WorkstreamsParams = {
  add?: string;
  includeArchived?: string;
  clientIds?: string;
};

function toUiStatus(status: WorkstreamStatus) {
  return status === "active" ? "active" : "inactive";
}

function fromUiStatus(status: string): WorkstreamStatus | null {
  if (status === "active") {
    return "active";
  }
  if (status === "inactive") {
    return "archived";
  }
  return null;
}

function toUiBillingType(type: BillingType) {
  return type === "fixed" ? "monthly_fixed" : "hourly";
}

function fromUiBillingType(type: string): BillingType | null {
  if (type === "hourly") {
    return "hourly";
  }
  if (type === "monthly_fixed") {
    return "fixed";
  }
  return null;
}

function parseDecimal(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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
  const billingType = fromUiBillingType(String(formData.get("billingType") || "hourly")) ?? "hourly";
  const status = fromUiStatus(String(formData.get("status") || "active")) ?? "active";
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
  const billingTypeRaw = String(formData.get("billingType") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();
  const rateRaw = String(formData.get("billingRate") || "").trim();
  if (!workstreamIds.length) {
    throw new Error("Workstream ids are required");
  }

  const data: {
    billingType?: BillingType;
    status?: WorkstreamStatus;
    billingRate?: number | null;
  } = {};

  const billingType = fromUiBillingType(billingTypeRaw);
  if (billingType) {
    data.billingType = billingType;
  }
  const status = fromUiStatus(statusRaw);
  if (status) {
    data.status = status;
  }

  if (rateRaw !== "") {
    const parsedRate = parseDecimal(rateRaw);
    if (parsedRate === null) {
      throw new Error("Billing rate must be a valid number");
    }
    data.billingRate = parsedRate;
  }

  await prisma.workstream.updateMany({
    where: { id: { in: workstreamIds }, tenantId },
    data
  });

  revalidatePath(`/${firmSlug}/workstreams`);
}

async function updateSingleWorkstream(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamId = String(formData.get("workstreamId") || "");
  const billingType = fromUiBillingType(String(formData.get("billingType") || "hourly")) ?? "hourly";
  const status = fromUiStatus(String(formData.get("status") || "active")) ?? "active";
  if (!workstreamId) {
    throw new Error("Workstream is required");
  }

  await prisma.workstream.updateMany({
    where: { id: workstreamId, tenantId },
    data: {
      billingType,
      status,
      billingRate: parseDecimal(formData.get("billingRate"))
    }
  });

  revalidatePath(`/${firmSlug}/workstreams`);
}

async function addWorkstreamToClient(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const templateWorkstreamId = String(formData.get("templateWorkstreamId") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!templateWorkstreamId || !clientId) {
    throw new Error("Workstream and client are required");
  }

  const template = await prisma.workstream.findFirst({
    where: { id: templateWorkstreamId, tenantId },
    select: { name: true, billingType: true, billingRate: true, status: true }
  });
  if (!template) {
    throw new Error("Workstream template not found");
  }

  const existing = await prisma.workstream.findFirst({
    where: {
      tenantId,
      clientId,
      name: template.name
    },
    select: { id: true }
  });
  if (existing) {
    throw new Error("This client already has this workstream");
  }

  await prisma.workstream.create({
    data: {
      tenantId,
      clientId,
      name: template.name,
      billingType: template.billingType,
      billingRate: template.billingRate,
      status: template.status
    }
  });

  revalidatePath(`/${firmSlug}/workstreams`);
}

async function deleteWorkstreamGroup(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamIds = String(formData.get("workstreamIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!workstreamIds.length) {
    throw new Error("Workstream ids are required");
  }

  try {
    await prisma.workstream.deleteMany({
      where: { tenantId, id: { in: workstreamIds } }
    });
  } catch {
    throw new Error("Unable to delete workstream. Remove related time entries first.");
  }

  revalidatePath(`/${firmSlug}/workstreams`);
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

        <div className="divide-y divide-[#ddd9d0]">
          {workstreamGroups.length === 0 ? (
            <p className="py-4 text-sm text-[#7a7a70]">No workstreams found.</p>
          ) : null}
          {workstreamGroups.map((group) => {
            const billingTypes = uniqueValues(group.rows.map((row) => toUiBillingType(row.billingType)));
            const statuses = uniqueValues(group.rows.map((row) => toUiStatus(row.status)));
            const rates = uniqueValues(group.rows.map((row) => (row.billingRate == null ? null : Number(row.billingRate))));
            const sharedBillingType = billingTypes.length === 1 ? billingTypes[0] : "";
            const sharedStatus = statuses.length === 1 ? statuses[0] : "";
            const sharedRate = rates.length === 1 ? rates[0] : undefined;
            const existingClientIds = new Set(group.rows.map((row) => row.clientId));
            const availableClients = clients.filter((client) => !existingClientIds.has(client.id));

            return (
              <details key={group.name} className="group/ws">
                <summary className="flex cursor-pointer items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
                  <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7a7a70] transition-transform group-open/ws:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="font-semibold text-[#1a2e1f]">{group.name}</span>
                  <span className="text-xs text-[#7a7a70]">
                    {group.clientNames.length} client{group.clientNames.length === 1 ? "" : "s"}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-[#7a7a70]">
                    <span>{sharedStatus || "mixed"}</span>
                    <span>•</span>
                    <span>{sharedBillingType === "monthly_fixed" ? "fixed" : sharedBillingType || "mixed"}</span>
                    {isAdmin && sharedRate !== undefined ? (
                      <>
                        <span>•</span>
                        <span>{sharedRate == null ? "—" : `$${Number(sharedRate).toFixed(2)}`}</span>
                      </>
                    ) : null}
                  </div>
                </summary>

                <div className="max-w-2xl pb-2.5 pl-7">
                  {isAdmin ? (
                    <>
                      <div className="mb-2 space-y-1">
                        {group.rows
                          .sort((a, b) => a.client.name.localeCompare(b.client.name))
                          .map((row) => (
                            <form
                              key={row.id}
                              action={updateSingleWorkstream}
                              className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[#f7f4ef]"
                            >
                              <input name="firmSlug" type="hidden" value={firmSlug} />
                              <input name="workstreamId" type="hidden" value={row.id} />
                              <span className="min-w-[120px] text-sm font-medium text-[#1a2e1f]">{row.client.name}</span>
                              <input
                                className="input !h-8 w-24 !py-1 text-xs"
                                defaultValue={row.billingRate == null ? "" : Number(row.billingRate).toString()}
                                name="billingRate"
                                placeholder="Rate"
                                step="0.01"
                                type="number"
                              />
                              <select className="input !h-8 w-28 !py-1 text-xs" defaultValue={toUiBillingType(row.billingType)} name="billingType">
                                <option value="hourly">hourly</option>
                                <option value="monthly_fixed">fixed</option>
                              </select>
                              <select className="input !h-8 w-24 !py-1 text-xs" defaultValue={toUiStatus(row.status)} name="status">
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                              </select>
                              <FormSubmitButton className="button !h-8 px-2.5 text-xs" pendingText="..." successText="Saved">Save</FormSubmitButton>
                            </form>
                          ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-[#ede9e1] pt-2">
                        <form action={updateWorkstreamGroup} className="flex items-center gap-1.5">
                          <input name="firmSlug" type="hidden" value={firmSlug} />
                          <input name="workstreamIds" type="hidden" value={group.rows.map((row) => row.id).join(",")} />
                          <select className="input !h-8 w-28 !py-1 text-xs" defaultValue={sharedBillingType} name="billingType">
                            <option value="">Billing...</option>
                            <option value="hourly">hourly</option>
                            <option value="monthly_fixed">fixed</option>
                          </select>
                          <select className="input !h-8 w-24 !py-1 text-xs" defaultValue={sharedStatus} name="status">
                            <option value="">Status...</option>
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                          <input
                            className="input !h-8 w-24 !py-1 text-xs"
                            defaultValue={sharedRate == null || sharedRate === undefined ? "" : Number(sharedRate).toString()}
                            name="billingRate"
                            placeholder="Rate"
                            step="0.01"
                            type="number"
                          />
                          <FormSubmitButton className="button-secondary !h-8 px-2.5 text-xs" pendingText="...">Apply all</FormSubmitButton>
                        </form>

                        {availableClients.length > 0 ? (
                          <form action={addWorkstreamToClient} className="flex items-center gap-1.5">
                            <input name="firmSlug" type="hidden" value={firmSlug} />
                            <input name="templateWorkstreamId" type="hidden" value={group.rows[0].id} />
                            <select className="input !h-8 !py-1 text-xs" name="clientId" required>
                              <option value="">Add client...</option>
                              {availableClients.map((client) => (
                                <option key={`${group.name}-${client.id}`} value={client.id}>
                                  {client.name}
                                </option>
                              ))}
                            </select>
                            <FormSubmitButton className="button-secondary !h-8 px-2.5 text-xs" pendingText="..." successText="Added">Add</FormSubmitButton>
                          </form>
                        ) : null}

                        <form action={deleteWorkstreamGroup} className="ml-auto">
                          <input name="firmSlug" type="hidden" value={firmSlug} />
                          <input name="workstreamIds" type="hidden" value={group.rows.map((row) => row.id).join(",")} />
                          <FormSubmitButton className="!h-8 px-2.5 text-xs text-red-600 transition-colors hover:text-red-800" pendingText="...">
                            Delete all
                          </FormSubmitButton>
                        </form>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-0.5">
                      {group.rows
                        .sort((a, b) => a.client.name.localeCompare(b.client.name))
                        .map((row) => (
                          <p key={row.id} className="px-2 py-0.5 text-sm text-[#4a4a42]">{row.client.name}</p>
                        ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
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
                <option value="monthly_fixed">monthly fixed</option>
              </select>
              <label className="text-sm text-[#4a4a42]">Billing Rate</label>
              <input className="input" name="billingRate" placeholder="Optional rate" step="0.01" type="number" />
              <label className="text-sm text-[#4a4a42]">Status</label>
              <select className="input" defaultValue="active" name="status">
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Link className="button-secondary" href={`/${firmSlug}/workstreams`}>Cancel</Link>
                <FormSubmitButton pendingText="Creating..." successText="Created">Create workstream</FormSubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
