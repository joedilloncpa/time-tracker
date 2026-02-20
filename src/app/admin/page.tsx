import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserContext, isAuthError } from "@/lib/auth";
import { ensureRole } from "@/lib/permissions";
import { ensureFirmWorkArea } from "@/lib/firm-work";
import { UserContext } from "@/lib/types";
import { UserMenu } from "@/components/user-menu";
import { FormSubmitButton } from "@/components/form-submit-button";

function safeHostFromUrl(value?: string) {
  if (!value) {
    return "not set";
  }
  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

function safeHostFromConnectionString(value?: string) {
  if (!value) {
    return "not set";
  }
  try {
    return new URL(value).host;
  } catch {
    return "invalid";
  }
}

function getSupabaseProjectRefFromAuthUrl(value?: string) {
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    const [projectRef] = parsed.hostname.split(".");
    return projectRef ?? "";
  } catch {
    return "";
  }
}

function getSupabaseProjectRefFromDatabaseUrl(value?: string) {
  if (!value) {
    return "";
  }
  try {
    const parsed = new URL(value);
    const username = decodeURIComponent(parsed.username || "");
    const parts = username.split(".");
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

function toSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createFirm(formData: FormData) {
  "use server";
  const user = await getUserContext();
  ensureRole(user, ["super_admin"]);

  const firmName = String(formData.get("firmName") || "").trim();
  const slugInput = String(formData.get("firmSlug") || "").trim();
  const adminName = String(formData.get("adminName") || "").trim();
  const adminEmail = String(formData.get("adminEmail") || "").trim().toLowerCase();

  if (!firmName || !adminEmail) {
    throw new Error("Firm name and admin email are required");
  }

  const firmSlug = toSlug(slugInput || firmName);
  if (!firmSlug) {
    throw new Error("Firm slug is invalid");
  }

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: firmName,
        slug: firmSlug,
        subscriptionStatus: "active"
      }
    });
    await ensureFirmWorkArea(tx, tenant.id);

    const existingUser = await tx.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingUser?.role === "super_admin") {
      throw new Error("Cannot assign a super admin as firm admin");
    }

    if (existingUser) {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          tenantId: tenant.id,
          role: "firm_admin",
          isActive: true,
          name: adminName || existingUser.name
        }
      });
    } else {
      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminEmail,
          name: adminName || adminEmail.split("@")[0],
          role: "firm_admin",
          isActive: true
        }
      });
    }
  });

  revalidatePath("/admin");
}

async function updateUserPermissions(formData: FormData) {
  "use server";
  const user = await getUserContext();
  ensureRole(user, ["super_admin"]);

  const targetUserId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "") as UserRole;
  const isActive = String(formData.get("isActive") || "true") === "true";

  if (!targetUserId) {
    throw new Error("userId is required");
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new Error("User not found");
  }

  if (target.role === "super_admin") {
    throw new Error("Super admin roles are not editable from this form");
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      role,
      isActive
    }
  });

  revalidatePath("/admin");
}

async function updateFirmSubscription(formData: FormData) {
  "use server";
  const user = await getUserContext();
  ensureRole(user, ["super_admin"]);

  const tenantId = String(formData.get("tenantId") || "");
  const subscriptionStatus = String(formData.get("subscriptionStatus") || "").trim();

  if (!tenantId || !subscriptionStatus) {
    throw new Error("tenantId and subscriptionStatus are required");
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus }
  });

  revalidatePath("/admin");
}

export default async function SuperAdminPage() {
  let user: UserContext;
  try {
    user = await getUserContext();
  } catch (error) {
    if (isAuthError(error, ["unauthorized"])) {
      redirect("/login?next=/admin");
    }
    if (isAuthError(error, ["not_provisioned"])) {
      redirect("/login?error=not_provisioned&next=/admin");
    }
    throw error;
  }
  ensureRole(user, ["super_admin"]);

  const [firmCount, userCount, activeSubs, firms, firmUsers, chainbridgeTenant] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count({ where: { role: { not: "super_admin" } } }),
    prisma.tenant.count({ where: { subscriptionStatus: "active" } }),
    prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    prisma.user.findMany({
      where: {
        role: {
          not: "super_admin"
        }
      },
      include: {
        tenant: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { tenantId: "asc" },
        { createdAt: "asc" }
      ]
    }),
    prisma.tenant.findUnique({
      where: { slug: "chainbridge" },
      select: { id: true, slug: true, name: true }
    })
  ]);
  const [
    chainbridgeClientCount,
    chainbridgeWorkstreamCount,
    chainbridgeVisibleClientCount,
    chainbridgeVisibleWorkstreamCount,
    sampleChainbridgeClients
  ] = chainbridgeTenant
    ? await Promise.all([
        prisma.client.count({ where: { tenantId: chainbridgeTenant.id } }),
        prisma.workstream.count({ where: { tenantId: chainbridgeTenant.id } }),
        prisma.client.count({
          where: {
            tenantId: chainbridgeTenant.id,
            status: "active",
            OR: [{ code: null }, { code: { not: "__FIRM_INTERNAL__" } }]
          }
        }),
        prisma.workstream.count({
          where: {
            tenantId: chainbridgeTenant.id,
            status: { not: "archived" },
            client: { OR: [{ code: null }, { code: { not: "__FIRM_INTERNAL__" } }] }
          }
        }),
        prisma.client.findMany({
          where: { tenantId: chainbridgeTenant.id },
          select: { id: true, name: true, status: true, code: true },
          orderBy: { createdAt: "desc" },
          take: 5
        })
      ])
    : [0, 0, 0, 0, []];
  const supabaseHost = safeHostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const databaseHost = safeHostFromConnectionString(process.env.DATABASE_URL);
  const authProjectRef = getSupabaseProjectRefFromAuthUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const dbProjectRef = getSupabaseProjectRefFromDatabaseUrl(process.env.DATABASE_URL);
  const projectMismatch = Boolean(authProjectRef && dbProjectRef && authProjectRef !== dbProjectRef);
  const preferredFirm =
    firms.find((firm) => firm.slug === "chainbridge") ??
    firms.find((firm) => firm.id === user.tenantId) ??
    firms[0] ??
    null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-brand-900">Super Admin Dashboard</h1>
          {preferredFirm ? (
            <Link className="button" href={`/${preferredFirm.slug}/dashboard`}>
              Switch to {preferredFirm.name}
            </Link>
          ) : null}
        </div>
        <UserMenu name={user.name} role={user.role} />
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card"><p className="text-sm text-slate-500">Firms</p><p className="text-3xl font-semibold">{firmCount}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Users</p><p className="text-3xl font-semibold">{userCount}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Active Subs</p><p className="text-3xl font-semibold">{activeSubs}</p></div>
      </section>
      <section className="card space-y-2">
        <h2 className="text-lg font-semibold">Data Source Diagnostics</h2>
        <p className="text-sm text-slate-600">
          App business data comes from <code>DATABASE_URL</code> (Prisma). Auth comes from <code>NEXT_PUBLIC_SUPABASE_URL</code>.
        </p>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p><span className="font-medium">Supabase Auth host:</span> {supabaseHost}</p>
          <p><span className="font-medium">Prisma DB host:</span> {databaseHost}</p>
          <p><span className="font-medium">Supabase auth project ref:</span> {authProjectRef || "unknown"}</p>
          <p><span className="font-medium">Prisma DB project ref:</span> {dbProjectRef || "unknown"}</p>
          <p><span className="font-medium">Chainbridge tenant:</span> {chainbridgeTenant ? `${chainbridgeTenant.name} (${chainbridgeTenant.id})` : "not found"}</p>
          <p><span className="font-medium">Current user tenantId:</span> {user.tenantId ?? "null"}</p>
          <p><span className="font-medium">Chainbridge clients in DB:</span> {chainbridgeClientCount}</p>
          <p><span className="font-medium">Chainbridge workstreams in DB:</span> {chainbridgeWorkstreamCount}</p>
          <p><span className="font-medium">Chainbridge clients visible in Clients page filter:</span> {chainbridgeVisibleClientCount}</p>
          <p><span className="font-medium">Chainbridge workstreams visible in Workstreams page filter:</span> {chainbridgeVisibleWorkstreamCount}</p>
        </div>
        {projectMismatch ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Critical: auth and database project refs do not match. Update Vercel <code>DATABASE_URL</code> to the same Supabase project as <code>NEXT_PUBLIC_SUPABASE_URL</code>.
          </p>
        ) : null}
        {sampleChainbridgeClients.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="mb-2 font-medium">Latest Chainbridge clients (name / status / code):</p>
            <ul className="space-y-1">
              {sampleChainbridgeClients.map((client) => (
                <li key={client.id}>{client.name} / {client.status} / {client.code ?? "-"}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Provision New Firm</h2>
        <form action={createFirm} className="grid gap-2 md:grid-cols-4">
          <input className="input" name="firmName" placeholder="Firm name" required />
          <input className="input" name="firmSlug" placeholder="Slug (optional)" />
          <input className="input" name="adminName" placeholder="Admin name" />
          <input className="input" name="adminEmail" type="email" placeholder="Admin email" required />
          <FormSubmitButton className="button md:col-span-1" pendingText="Creating..." successText="Created">
            Create firm
          </FormSubmitButton>
        </form>
      </section>
      <section className="card">
        <h2 className="text-lg font-semibold">Firms</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {firms.map((firm) => (
            <li key={firm.id} className="flex flex-wrap items-center justify-between rounded border border-slate-200 px-3 py-2">
              <div>
                <p className="font-medium">{firm.name}</p>
                <p className="text-slate-500">{firm.slug} • {firm.subscriptionStatus}</p>
              </div>
              <div className="flex items-center gap-3">
                <span>{firm._count.users} users</span>
                <form action={updateFirmSubscription} className="flex items-center gap-2">
                  <input type="hidden" name="tenantId" value={firm.id} />
                  <select className="input h-9 w-40 py-1 text-xs" name="subscriptionStatus" defaultValue={firm.subscriptionStatus}>
                    <option value="active">active</option>
                    <option value="trialing">trialing</option>
                    <option value="past_due">past_due</option>
                    <option value="canceled">canceled</option>
                    <option value="inactive">inactive</option>
                  </select>
                  <FormSubmitButton className="button-secondary h-9 px-2 text-xs" pendingText="Updating...">
                    Update
                  </FormSubmitButton>
                </form>
                <Link href={`/${firm.slug}/dashboard`} className="button-secondary">Impersonate</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2 className="text-lg font-semibold">User Permissions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2">User</th>
                <th className="py-2">Firm</th>
                <th className="py-2">Role</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {firmUsers.map((member) => (
                <tr key={member.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </td>
                  <td className="py-2">{member.tenant?.name ?? "No firm"}</td>
                  <td className="py-2">
                    <form action={updateUserPermissions} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={member.id} />
                      <select className="input h-9 w-32 py-1 text-xs" name="role" defaultValue={member.role}>
                        <option value="firm_admin">firm_admin</option>
                        <option value="firm_user">firm_user</option>
                      </select>
                      <select className="input h-9 w-24 py-1 text-xs" name="isActive" defaultValue={String(member.isActive)}>
                        <option value="true">active</option>
                        <option value="false">inactive</option>
                      </select>
                      <FormSubmitButton className="button-secondary h-9 px-2 text-xs" pendingText="Saving...">
                        Save
                      </FormSubmitButton>
                    </form>
                  </td>
                  <td className="py-2">{member.isActive ? "Active" : "Inactive"}</td>
                  <td className="py-2 text-xs text-slate-500">{member.tenant?.slug ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
