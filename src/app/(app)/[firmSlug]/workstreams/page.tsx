import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BillingType, WorkstreamStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserContext } from "@/lib/auth";
import { ensureRole } from "@/lib/permissions";
import { ExcelFilterField } from "@/components/excel-filter-field";
import { assertTenantBySlug } from "@/lib/tenant";

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
      where: { tenantId },
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

async function updateWorkstream(formData: FormData) {
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
      billingRate: parseDecimal(formData.get("billingRate")),
      status
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
    where: { tenantId },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" }
  });

  const workstreams = await prisma.workstream.findMany({
    where: {
      tenantId,
      ...(includeArchived ? {} : { status: "active" }),
      ...(selectedClientIds.length ? { clientId: { in: selectedClientIds } } : {})
    },
    include: {
      client: {
        select: { id: true, name: true }
      }
    },
    orderBy: [{ name: "asc" }, { client: { name: "asc" } }]
  });

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
          {workstreams.length === 0 ? (
            <li className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-4 text-sm text-[#7a7a70]">
              No workstreams found.
            </li>
          ) : null}
          {workstreams.map((workstream) => (
            <li key={workstream.id} className="rounded-lg border border-[#ddd9d0] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#1a2e1f]">{workstream.name}</p>
                  <p className="text-sm text-[#7a7a70]">{workstream.client.name}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#7a7a70]">
                  <span>{workstream.status}</span>
                  <span>•</span>
                  <span>{workstream.billingType}</span>
                  <span>•</span>
                  <span>{workstream.billingRate == null ? "No rate" : `$${Number(workstream.billingRate).toFixed(2)}/hr`}</span>
                </div>
              </div>

              {isAdmin ? (
                <form action={updateWorkstream} className="mt-3 grid gap-3 rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3 md:grid-cols-3">
                  <input name="firmSlug" type="hidden" value={firmSlug} />
                  <input name="workstreamId" type="hidden" value={workstream.id} />
                  <input name="includeArchived" type="hidden" value={includeArchived ? "1" : "0"} />
                  <input name="selectedClientIds" type="hidden" value={selectedClientIds.join(",")} />
                  <input className="input" defaultValue={workstream.name} name="name" placeholder="Workstream name" required />
                  <select className="input" defaultValue={workstream.clientId} name="clientId">
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                  <input
                    className="input"
                    defaultValue={workstream.billingRate == null ? "" : Number(workstream.billingRate).toString()}
                    name="billingRate"
                    placeholder="Billing rate"
                    step="0.01"
                    type="number"
                  />
                  <select className="input" defaultValue={workstream.billingType} name="billingType">
                    <option value="hourly">hourly</option>
                    <option value="fixed">fixed</option>
                    <option value="retainer">retainer</option>
                  </select>
                  <select className="input" defaultValue={workstream.status} name="status">
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="complete">complete</option>
                    <option value="archived">archived</option>
                  </select>
                  <button className="button md:justify-self-end" type="submit">Save</button>
                </form>
              ) : null}
            </li>
          ))}
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
