import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ClientStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserContext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ExcelFilterField } from "@/components/excel-filter-field";
import { INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { assertTenantBySlug } from "@/lib/tenant";
import { FormSubmitButton } from "@/components/form-submit-button";

function parseClientStatus(value: FormDataEntryValue | null): ClientStatus {
  const normalized = String(value ?? "").trim();
  if (normalized === "inactive") {
    return "inactive";
  }
  // Treat missing/invalid/prospect as active for default behavior.
  return "active";
}

async function resolveTenantContext(firmSlug: string) {
  const [user, tenant] = await Promise.all([
    getUserContext(firmSlug),
    assertTenantBySlug(firmSlug)
  ]);
  return { user, tenantId: tenant.id };
}

async function createClient(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { tenantId } = await resolveTenantContext(firmSlug);

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    throw new Error("Client name is required");
  }

  await prisma.client.create({
    data: {
      tenantId,
      name,
      code: String(formData.get("code") || "").trim() || null,
      contactName: String(formData.get("contactName") || "").trim() || null,
      contactEmail: String(formData.get("contactEmail") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      industry: String(formData.get("industry") || "").trim() || null,
      status: parseClientStatus(formData.get("status")),
      tags: String(formData.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    }
  });

  revalidatePath(`/${firmSlug}/clients`);
  redirect(`/${firmSlug}/clients`);
}

async function updateClient(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { tenantId } = await resolveTenantContext(firmSlug);
  const includeInactive = String(formData.get("includeInactive") || "") === "1";
  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!clientId || !name) {
    throw new Error("Client name is required");
  }

  await prisma.client.updateMany({
    where: {
      id: clientId,
      tenantId
    },
    data: {
      name,
      code: String(formData.get("code") || "").trim() || null,
      contactName: String(formData.get("contactName") || "").trim() || null,
      contactEmail: String(formData.get("contactEmail") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      industry: String(formData.get("industry") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      budgetHours: formData.get("budgetHours") ? Number(formData.get("budgetHours")) : null,
      budgetAmount: formData.get("budgetAmount") ? Number(formData.get("budgetAmount")) : null,
      qboXeroLink: String(formData.get("qboXeroLink") || "").trim() || null,
      status: formData.get("isInactive") ? "inactive" : parseClientStatus(formData.get("status")),
      tags: String(formData.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    }
  });

  revalidatePath(`/${firmSlug}/clients`);
  const query = includeInactive ? "?includeInactive=1" : "";
  redirect(`/${firmSlug}/clients${query}`);
}

async function createWorkstream(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { tenantId } = await resolveTenantContext(firmSlug);
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error("Workstream name is required");
  }

  const allClientsSelected = formData.get("allClients") === "on";
  const explicitClientIds = formData
    .getAll("clientIds")
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  let targetClientIds = explicitClientIds;
  if (allClientsSelected) {
    const allClients = await prisma.client.findMany({
      where: {
        tenantId,
        OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
      },
      select: { id: true }
    });
    targetClientIds = allClients.map((client) => client.id);
  }

  if (targetClientIds.length === 0) {
    throw new Error("Select at least one client or choose All clients");
  }

  await prisma.workstream.createMany({
    data: targetClientIds.map((clientId) => ({
      tenantId,
      clientId,
      name
    }))
  });

  revalidatePath(`/${firmSlug}/clients`);
  redirect(`/${firmSlug}/clients`);
}

async function updateWorkstreamStatus(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const { tenantId } = await resolveTenantContext(firmSlug);
  const workstreamId = String(formData.get("workstreamId") || "");

  if (!workstreamId) {
    throw new Error("Workstream is required");
  }

  const nextStatus = String(formData.get("status") || "");
  if (nextStatus !== "active" && nextStatus !== "archived") {
    throw new Error("Invalid status");
  }

  await prisma.workstream.updateMany({
    where: {
      id: workstreamId,
      tenantId
    },
    data: {
      status: nextStatus
    }
  });

  revalidatePath(`/${firmSlug}/clients`);
}

export default async function ClientsPage({
  params,
  searchParams
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<{ addClient?: string; addWorkstream?: string; includeInactive?: string; editClient?: string }>;
}) {
  const { firmSlug } = await params;
  const { addClient, addWorkstream, includeInactive, editClient } = await searchParams;
  const { user, tenantId } = await resolveTenantContext(firmSlug);
  const openAddClient = addClient === "1";
  const openAddWorkstream = addWorkstream === "1";
  const showInactiveClients = includeInactive === "1";
  const editClientId = editClient || "";

  const defaultClients = await prisma.client.findMany({
    where: {
      tenantId,
      OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }],
      ...(showInactiveClients ? {} : { status: "active" })
    },
    include: {
      workstreams: {
        orderBy: { name: "asc" }
      }
    },
    orderBy: { name: "asc" }
  });
  const fallbackClients =
    !showInactiveClients && defaultClients.length === 0
      ? await prisma.client.findMany({
          where: {
            tenantId,
            OR: [{ code: null }, { code: { not: INTERNAL_FIRM_CLIENT_CODE } }]
          },
          include: {
            workstreams: {
              orderBy: { name: "asc" }
            }
          },
          orderBy: { name: "asc" }
        })
      : [];
  const clients = fallbackClients.length > 0 ? fallbackClients : defaultClients;
  const billableClients = clients.filter((client) => client.code !== INTERNAL_FIRM_CLIENT_CODE);

  return (
    <main className="space-y-6">
      <section className="flex items-center gap-3 pl-2 md:pl-4">
        <h1 className="text-2xl font-semibold text-brand-900">Clients &amp; Workstreams</h1>
        <Link className="button" href={`/${firmSlug}/clients?addClient=1`}>
          Add Client
        </Link>
        <Link className="button-secondary px-4" href={`/${firmSlug}/clients?addWorkstream=1`}>
          Add Workstream
        </Link>
      </section>

      <section className="card ml-2 w-full max-w-5xl md:ml-4">
        <h2 className="text-lg font-semibold">Client List</h2>
        {!showInactiveClients && fallbackClients.length > 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No active clients were found, so all clients are shown.
          </p>
        ) : null}
        <form className="mt-3" method="GET">
          <label className="inline-flex items-center gap-2 text-sm text-[#1a2e1f]">
            <input
              defaultChecked={showInactiveClients}
              name="includeInactive"
              type="checkbox"
              value="1"
            />
            Include inactive clients
          </label>
          <button className="button-secondary ml-3 px-3" type="submit">Apply</button>
        </form>
        <div className="mt-4 divide-y divide-[#ddd9d0]">
          {clients.length === 0 ? (
            <p className="py-4 text-sm text-[#7a7a70]">No clients yet.</p>
          ) : null}
          {clients.map((client) => (
            <details key={client.id} className="group/client">
              <summary className="flex cursor-pointer items-center gap-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7a7a70] transition-transform group-open/client:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="font-semibold text-[#1a2e1f]">{client.name}</span>
                <span className="text-xs text-[#7a7a70]">{client.workstreams.length} workstream{client.workstreams.length === 1 ? "" : "s"}</span>
                <Link className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-[#7a7a70] transition-colors hover:bg-[#f7f4ef] hover:text-[#4a4a42]" href={`/${firmSlug}/clients?editClient=${client.id}${showInactiveClients ? "&includeInactive=1" : ""}`} title="Client settings">
                  <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="3.5" />
                    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
                  </svg>
                </Link>
              </summary>

              <div className="pb-2.5 pl-7">
                {editClientId === client.id ? (
                  <form action={updateClient} className="mb-2 grid gap-2 rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3 md:grid-cols-3">
                    <input type="hidden" name="firmSlug" value={firmSlug} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="hidden" name="includeInactive" value={showInactiveClients ? "1" : "0"} />
                    <input className="input" defaultValue={client.name} name="name" placeholder="Client name" required />
                    <input className="input" defaultValue={client.code ?? ""} name="code" placeholder="Code" />
                    <input className="input" defaultValue={client.contactName ?? ""} name="contactName" placeholder="Primary contact" />
                    <input className="input" defaultValue={client.contactEmail ?? ""} name="contactEmail" placeholder="Contact email" type="email" />
                    <input className="input" defaultValue={client.phone ?? ""} name="phone" placeholder="Phone" />
                    <input className="input" defaultValue={client.industry ?? ""} name="industry" placeholder="Industry" />
                    <select className="input" defaultValue={client.status} name="status">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <input className="input" defaultValue={client.budgetHours?.toString() ?? ""} name="budgetHours" placeholder="Budget hours" step="0.01" type="number" />
                    <input className="input" defaultValue={client.budgetAmount?.toString() ?? ""} name="budgetAmount" placeholder="Budget amount" step="0.01" type="number" />
                    <input className="input md:col-span-2" defaultValue={client.qboXeroLink ?? ""} name="qboXeroLink" placeholder="QBO/Xero link" />
                    <input className="input md:col-span-3" defaultValue={client.tags.join(", ")} name="tags" placeholder="Tags (comma separated)" />
                    <input className="input md:col-span-3" defaultValue={client.notes ?? ""} name="notes" placeholder="Notes" />
                    <label className="inline-flex items-center gap-2 text-sm text-[#1a2e1f]">
                      <input defaultChecked={client.status === "inactive"} name="isInactive" type="checkbox" />
                      Make client inactive
                    </label>
                    <FormSubmitButton className="button md:justify-self-end" pendingText="Saving...">
                      Save
                    </FormSubmitButton>
                  </form>
                ) : null}
                {client.workstreams.length === 0 ? (
                  <p className="text-sm text-[#7a7a70]">No workstreams yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {client.workstreams.map((workstream) => (
                      <form key={workstream.id} action={updateWorkstreamStatus} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-[#f7f4ef]">
                        <input name="firmSlug" type="hidden" value={firmSlug} />
                        <input name="workstreamId" type="hidden" value={workstream.id} />
                        <input name="status" type="hidden" value={workstream.status === "active" ? "archived" : "active"} />
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${workstream.status === "active" ? "text-[#1a2e1f]" : "text-[#7a7a70]"}`}>{workstream.name}</span>
                          {workstream.status !== "active" ? (
                            <span className="text-[11px] text-[#7a7a70]">archived</span>
                          ) : null}
                        </div>
                        <button
                          aria-label={`Toggle ${workstream.name} ${workstream.status === "active" ? "inactive" : "active"}`}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
                            workstream.status === "active"
                              ? "border-[#24482f] bg-[#24482f]"
                              : "border-[#c9c4b8] bg-[#e5e1d9]"
                          }`}
                          type="submit"
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                              workstream.status === "active" ? "translate-x-[18px]" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {openAddClient ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(20,18,12,0.25)] p-6 pt-16">
          <div className="w-full max-w-2xl rounded-2xl border border-[#ddd9d0] bg-white shadow-[0_8px_32px_rgba(20,18,12,0.16)]">
            <div className="flex items-center justify-between border-b border-[#ddd9d0] px-6 py-4">
              <h2 className="cb-display text-3xl text-[#1a2e1f]">Add Client</h2>
              <Link className="button-secondary px-3" href={`/${firmSlug}/clients`}>
                Close
              </Link>
            </div>
            <form action={createClient} className="grid gap-3 p-6">
              <input type="hidden" name="firmSlug" value={firmSlug} />
              <input className="input" name="name" placeholder="Client name" required />
              <input className="input" name="code" placeholder="Code (optional)" />
              <select className="input" name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="prospect">Prospect</option>
              </select>
              <div className="space-y-3 rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3">
                <p className="text-sm font-medium text-[#1a2e1f]">Optional contact details</p>
                <input className="input" name="contactName" placeholder="Primary contact name (optional)" />
                <input className="input" name="contactEmail" placeholder="Primary contact email (optional)" type="email" />
                <input className="input" name="phone" placeholder="Primary contact phone (optional)" />
                <input className="input" name="industry" placeholder="Industry (optional)" />
              </div>
              <input className="input" name="tags" placeholder="Tags (comma separated)" />
              <div className="flex justify-end gap-2">
                <Link className="button-secondary px-4" href={`/${firmSlug}/clients`}>
                  Cancel
                </Link>
                <FormSubmitButton className="button px-5" pendingText="Creating..." successText="Created">
                  Create client
                </FormSubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {openAddWorkstream ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(20,18,12,0.25)] p-6 pt-16">
          <div className="w-full max-w-2xl rounded-2xl border border-[#ddd9d0] bg-white shadow-[0_8px_32px_rgba(20,18,12,0.16)]">
            <div className="flex items-center justify-between border-b border-[#ddd9d0] px-6 py-4">
              <h2 className="cb-display text-3xl text-[#1a2e1f]">Add Workstream</h2>
              <Link className="button-secondary px-3" href={`/${firmSlug}/clients`}>
                Close
              </Link>
            </div>
            <form action={createWorkstream} className="grid gap-3 p-6">
              <input type="hidden" name="firmSlug" value={firmSlug} />
              <input className="input" name="name" placeholder="Workstream name" required />
              <label className="inline-flex items-center gap-2 text-sm text-[#1a2e1f]">
                <input name="allClients" type="checkbox" />
                Apply to all clients
              </label>
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#1a2e1f]">Select one or more clients</p>
                <ExcelFilterField
                  autoSubmit={false}
                  name="clientIds"
                  options={billableClients.map((client) => ({ value: client.id, label: client.name }))}
                  placeholder="Select clients"
                  selected={[]}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Link className="button-secondary px-4" href={`/${firmSlug}/clients`}>
                  Cancel
                </Link>
                <FormSubmitButton className="button px-5" pendingText="Creating..." successText="Created">
                  Create workstream
                </FormSubmitButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
