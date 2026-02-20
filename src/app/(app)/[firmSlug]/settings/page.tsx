import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getUserContext, isAuthError } from "@/lib/auth";
import { ensureRole } from "@/lib/permissions";
import { ExcelFilterField } from "@/components/excel-filter-field";
import { ensureFirmWorkArea, INTERNAL_FIRM_CLIENT_CODE } from "@/lib/firm-work";
import { assertTenantBySlug } from "@/lib/tenant";
import {
  getAllowedClientIdsForUser,
  normalizeTenantSettings,
  withUserClientPermissions
} from "@/lib/tenant-settings";
import { getAuthRedirectOrigin } from "@/lib/url";

type SettingsParams = {
  section?: string;
  inviteError?: string;
  inviteSuccess?: string;
};

function isRedirectControlError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const digest = (error as Error & { digest?: string }).digest;
  return error.message === "NEXT_REDIRECT" || (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"));
}

function parseDecimal(value: FormDataEntryValue | null) {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

async function updateProfile(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error("Name is required");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function changePassword(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  await getUserContext(firmSlug);

  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  if (process.env.AUTH_MODE === "dev") {
    revalidatePath(`/${firmSlug}/settings`);
    return;
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase auth environment variables are missing");
  }

  const cookieStore = await cookies();
  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookieValues: CookieToSet[]) {
          cookieValues.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      }
    }
  );

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw new Error(error.message || "Unable to update password");
  }

  revalidatePath(`/${firmSlug}/settings`);
}

async function inviteUser(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const redirectBase = `/${firmSlug}/settings?section=users`;
  const redirectWithError = (message: string) => {
    redirect(`${redirectBase}&inviteError=${encodeURIComponent(message)}`);
  };

  try {
    const user = await getUserContext(firmSlug);
    ensureRole(user, ["firm_admin", "super_admin"]);

    const email = String(formData.get("email") || "").trim().toLowerCase();
    const name = String(formData.get("name") || "").trim();
    const roleValue = String(formData.get("role") || "firm_user");
    const role = roleValue === "firm_admin" ? "firm_admin" : "firm_user";

    if (!email) {
      redirectWithError("Email is required");
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      redirectWithError("Supabase invite is not configured.");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.tenantId && existing.tenantId !== user.tenantId) {
      redirectWithError("This email already belongs to another firm");
    }

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          tenantId: user.tenantId ?? "",
          role,
          isActive: true,
          name: name || existing.name
        }
      });
    } else {
      await prisma.user.create({
        data: {
          tenantId: user.tenantId ?? "",
          email,
          name: name || email.split("@")[0],
          role
        }
      });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const requestHeaders = await headers();
    const authOrigin = getAuthRedirectOrigin(requestHeaders);
    const redirectTo = authOrigin ? `${authOrigin}/auth/callback` : undefined;
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      ...(redirectTo ? { redirectTo } : {})
    });

    if (error) {
      redirectWithError(error.message || "Unable to send invite email");
    }

    revalidatePath(`/${firmSlug}/settings`);
    redirect(`${redirectBase}&inviteSuccess=1`);
  } catch (error) {
    if (isRedirectControlError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unable to send invite email";
    redirectWithError(message);
  }
}

async function updateUserRole(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const userId = String(formData.get("userId") || "");
  const role = String(formData.get("role") || "firm_user") as UserRole;
  if (!userId || (role !== "firm_user" && role !== "firm_admin")) {
    throw new Error("Invalid user role update");
  }

  await prisma.user.updateMany({
    where: {
      id: userId,
      tenantId: user.tenantId ?? "",
      role: { not: "super_admin" }
    },
    data: { role }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function updateUserStatus(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const userId = String(formData.get("userId") || "");
  const isActive = formData.get("isActive") === "1";
  if (!userId) {
    throw new Error("User is required");
  }

  await prisma.user.updateMany({
    where: {
      id: userId,
      tenantId: user.tenantId ?? "",
      role: { not: "super_admin" }
    },
    data: { isActive }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function updateUserClientAccess(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const tenantId = user.tenantId ?? "";
  const userId = String(formData.get("userId") || "");
  const allowAll = formData.get("allClients") === "1";
  const clientIds = String(formData.get("clientIds") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!userId) {
    throw new Error("User is required");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settingsJson: true }
  });

  const nextSettings = withUserClientPermissions(tenant?.settingsJson, userId, allowAll ? null : clientIds);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settingsJson: nextSettings }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function updateCostRate(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const userId = String(formData.get("userId") || "");
  await prisma.user.updateMany({
    where: { id: userId, tenantId: user.tenantId ?? "" },
    data: { costRate: parseDecimal(formData.get("costRate")) }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function updateWorkstreamBillingRate(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamId = String(formData.get("workstreamId") || "");
  await prisma.workstream.updateMany({
    where: { id: workstreamId, tenantId: user.tenantId ?? "" },
    data: { billingRate: parseDecimal(formData.get("rate")) }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function applyRateToAllWorkstreams(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const clientId = String(formData.get("clientId") || "");
  const rate = parseDecimal(formData.get("rate"));
  if (!clientId) {
    throw new Error("Client is required");
  }

  await prisma.workstream.updateMany({
    where: { tenantId: user.tenantId ?? "", clientId },
    data: { billingRate: rate }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function applyRateToMissingWorkstreamName(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const workstreamName = String(formData.get("workstreamName") || "").trim();
  const rate = parseDecimal(formData.get("rate"));
  if (!workstreamName) {
    throw new Error("Workstream name is required");
  }
  if (rate === null) {
    throw new Error("Rate is required");
  }

  await prisma.workstream.updateMany({
    where: {
      tenantId: user.tenantId ?? "",
      name: workstreamName,
      billingRate: null
    },
    data: { billingRate: rate }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function createFirmWorkstream(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const tenantId = user.tenantId ?? "";
  if (!tenantId) {
    throw new Error("Missing tenant context");
  }

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    throw new Error("Workstream name is required");
  }

  await ensureFirmWorkArea(prisma, tenantId);
  const firmClient = await prisma.client.findFirst({
    where: {
      tenantId,
      code: INTERNAL_FIRM_CLIENT_CODE
    },
    select: { id: true }
  });

  if (!firmClient) {
    throw new Error("Firm work area not found");
  }

  const existing = await prisma.workstream.findFirst({
    where: {
      tenantId,
      clientId: firmClient.id,
      name
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error("A Firm workstream with this name already exists");
  }

  await prisma.workstream.create({
    data: {
      tenantId,
      clientId: firmClient.id,
      name,
      status: "active",
      billingType: "hourly",
      billingRate: null
    }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function lockPeriod(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const period = String(formData.get("period") || "");
  const [yearText, monthText] = period.split("-");
  const periodYear = Number(yearText);
  const periodMonth = Number(monthText);
  if (!periodYear || !periodMonth) {
    throw new Error("Invalid period");
  }

  await prisma.lockedPeriod.upsert({
    where: {
      tenantId_periodYear_periodMonth: {
        tenantId: user.tenantId ?? "",
        periodYear,
        periodMonth
      }
    },
    create: {
      tenantId: user.tenantId ?? "",
      periodYear,
      periodMonth,
      lockedByUserId: user.id
    },
    update: {
      lockedAt: new Date(),
      lockedByUserId: user.id,
      unlockedAt: null,
      unlockedByUserId: null
    }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

async function unlockPeriod(formData: FormData) {
  "use server";
  const firmSlug = String(formData.get("firmSlug") || "");
  const user = await getUserContext(firmSlug);
  ensureRole(user, ["firm_admin", "super_admin"]);

  const lockId = String(formData.get("lockId") || "");
  await prisma.lockedPeriod.update({
    where: { id: lockId },
    data: {
      unlockedAt: new Date(),
      unlockedByUserId: user.id
    }
  });

  revalidatePath(`/${firmSlug}/settings`);
}

export default async function SettingsPage({
  params,
  searchParams
}: {
  params: Promise<{ firmSlug: string }>;
  searchParams: Promise<SettingsParams>;
}) {
  const { firmSlug } = await params;
  const { section, inviteError, inviteSuccess } = await searchParams;
  await assertTenantBySlug(firmSlug).catch(() => null);

  let user: Awaited<ReturnType<typeof getUserContext>>;
  try {
    user = await getUserContext(firmSlug);
  } catch (error) {
    if (isAuthError(error, ["unauthorized"])) {
      redirect(`/login?next=/${firmSlug}/settings`);
    }
    if (isAuthError(error, ["not_provisioned"])) {
      redirect(`/login?error=not_provisioned&next=/${firmSlug}/settings`);
    }
    throw error;
  }

  const isAdmin = user.role === "firm_admin" || user.role === "super_admin";

  const [tenant, users, clients, workstreams, lockedPeriods] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: user.tenantId ?? "" },
      select: { name: true, settingsJson: true }
    }),
    isAdmin
      ? prisma.user.findMany({
          where: {
            tenantId: user.tenantId ?? "",
            role: { not: "super_admin" }
          },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.client.findMany({
          where: { tenantId: user.tenantId ?? "" },
          orderBy: { name: "asc" }
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.workstream.findMany({
          where: { tenantId: user.tenantId ?? "" },
          orderBy: [{ name: "asc" }]
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.lockedPeriod.findMany({
          where: { tenantId: user.tenantId ?? "" },
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }]
        })
      : Promise.resolve([])
  ]);

  const adminSections = [
    { id: "profile", label: "My Profile" },
    { id: "security", label: "Security" },
    { id: "users", label: "Users & Access" },
    { id: "cost_rates", label: "Cost Rates" },
    { id: "billing_rates", label: "Billing Rates" },
    { id: "firm_workstreams", label: "Firm Workstreams" },
    { id: "period_locking", label: "Period Locking" }
  ];
  const memberSections = [
    { id: "profile", label: "My Profile" },
    { id: "security", label: "Security" }
  ];
  const sections = isAdmin ? adminSections : memberSections;
  const activeSection = sections.some((item) => item.id === section) ? section! : "profile";
  const tenantSettings = normalizeTenantSettings(tenant?.settingsJson);
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const userById = new Map(users.map((member) => [member.id, member]));
  const sortedWorkstreams = [...workstreams].sort((a, b) => {
    const aClientName = clientById.get(a.clientId)?.name ?? "";
    const bClientName = clientById.get(b.clientId)?.name ?? "";
    return aClientName.localeCompare(bClientName) || a.name.localeCompare(b.name);
  });
  const billableClients = clients.filter((client) => client.code !== INTERNAL_FIRM_CLIENT_CODE);
  const firmWorkstreams = sortedWorkstreams.filter((workstream) => {
    const client = clientById.get(workstream.clientId);
    return client?.code === INTERNAL_FIRM_CLIENT_CODE;
  });
  const missingWorkstreamGroups = sortedWorkstreams
    .filter((workstream) => {
      const client = clientById.get(workstream.clientId);
      return client?.code !== INTERNAL_FIRM_CLIENT_CODE;
    })
    .filter((workstream) => workstream.billingRate == null)
    .reduce<Map<string, { name: string; clients: string[]; count: number }>>((map, workstream) => {
      const client = clientById.get(workstream.clientId);
      const clientName = client?.name ?? "Unknown client";
      const existing = map.get(workstream.name);
      if (existing) {
        existing.count += 1;
        if (!existing.clients.includes(clientName)) {
          existing.clients.push(clientName);
        }
      } else {
        map.set(workstream.name, {
          name: workstream.name,
          clients: [clientName],
          count: 1
        });
      }
      return map;
    }, new Map());

  return (
    <main className="space-y-6">
      <h1 className="pl-2 text-2xl font-semibold text-brand-900 md:pl-4">Settings</h1>
      <section className="ml-2 flex w-full max-w-[1200px] gap-4 md:ml-4">
        <aside className="w-52 shrink-0">
          <div className="card space-y-2 p-3">
            {sections.map((item) => (
              <Link
                key={item.id}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  activeSection === item.id
                    ? "border border-[#24482f] bg-[#f7f4ef] text-[#1c3a28]"
                    : "text-[#4a4a42] hover:bg-[#ede9e1]"
                }`}
                href={`/${firmSlug}/settings?section=${item.id}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {activeSection === "profile" ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold">My Profile</h2>
              <form action={updateProfile} className="grid max-w-xl gap-3">
                <input name="firmSlug" type="hidden" value={firmSlug} />
                <label className="text-sm text-[#4a4a42]">Email</label>
                <input className="input" disabled value={user.email} />
                <label className="text-sm text-[#4a4a42]">Firm</label>
                <input className="input" disabled value={tenant?.name ?? "Not assigned"} />
                <label className="text-sm text-[#4a4a42]">Name</label>
                <input className="input" defaultValue={user.name} name="name" required />
                <button className="button w-fit px-5" type="submit">Save profile</button>
              </form>
            </section>
          ) : null}

          {activeSection === "security" ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold">Security</h2>
              <form action={changePassword} className="grid max-w-xl gap-3">
                <input name="firmSlug" type="hidden" value={firmSlug} />
                <input className="input" minLength={8} name="password" placeholder="New password" required type="password" />
                <input className="input" minLength={8} name="confirmPassword" placeholder="Confirm new password" required type="password" />
                <button className="button w-fit px-5" type="submit">Change password</button>
                <Link className="button-secondary w-fit px-5" href="/auth/logout">Sign out</Link>
                {process.env.AUTH_MODE === "dev" ? (
                  <p className="text-xs text-[#7a7a70]">Dev auth mode is enabled; password updates are skipped locally.</p>
                ) : null}
              </form>
            </section>
          ) : null}

          {isAdmin && activeSection === "users" ? (
            <>
              <section className="card space-y-3">
                <h2 className="text-lg font-semibold">Invite Team Member</h2>
                {inviteError ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {inviteError}
                  </p>
                ) : null}
                {inviteSuccess === "1" ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Invite sent successfully.
                  </p>
                ) : null}
                <form action={inviteUser} className="grid gap-3 md:grid-cols-4">
                  <input name="firmSlug" type="hidden" value={firmSlug} />
                  <input className="input md:col-span-2" name="email" placeholder="Email" required type="email" />
                  <input className="input" name="name" placeholder="Name (optional)" />
                  <select className="input" defaultValue="firm_user" name="role">
                    <option value="firm_user">Team Member</option>
                    <option value="firm_admin">Firm Admin</option>
                  </select>
                  <button className="button w-fit px-5" type="submit">Invite</button>
                </form>
              </section>

              <section className="card space-y-3">
                <h2 className="text-lg font-semibold">Manage Users</h2>
                <ul className="space-y-3">
                  {users.map((member) => {
                    const allowed = getAllowedClientIdsForUser(tenantSettings, member.id, member.role);
                    return (
                      <li key={member.id} className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-[#1a2e1f]">{member.name}</p>
                            <p className="text-sm text-[#7a7a70]">{member.email}</p>
                          </div>
                          <span className="text-xs text-[#7a7a70]">{member.isActive ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          <form action={updateUserRole} className="flex items-center gap-2">
                            <input name="firmSlug" type="hidden" value={firmSlug} />
                            <input name="userId" type="hidden" value={member.id} />
                            <select className="input" defaultValue={member.role} name="role">
                              <option value="firm_user">Team Member</option>
                              <option value="firm_admin">Firm Admin</option>
                            </select>
                            <button className="button-secondary px-3" type="submit">Save role</button>
                          </form>

                          <form action={updateUserStatus} className="flex items-center gap-2">
                            <input name="firmSlug" type="hidden" value={firmSlug} />
                            <input name="userId" type="hidden" value={member.id} />
                            <input name="isActive" type="hidden" value={member.isActive ? "0" : "1"} />
                            <button className="button-secondary px-3" type="submit">
                              {member.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>

                        <form action={updateUserClientAccess} className="mt-3 flex flex-wrap items-center gap-2">
                          <input name="firmSlug" type="hidden" value={firmSlug} />
                          <input name="userId" type="hidden" value={member.id} />
                          <label className="inline-flex items-center gap-2 text-sm text-[#4a4a42]">
                            <input defaultChecked={!allowed} name="allClients" type="checkbox" value="1" />
                            All clients
                          </label>
                          <ExcelFilterField
                            autoSubmit={false}
                            name="clientIds"
                            options={clients.map((client) => ({ value: client.id, label: client.name }))}
                            placeholder="Allowed clients"
                            selected={allowed ?? clients.map((client) => client.id)}
                          />
                          <button className="button-secondary px-3" type="submit">Save access</button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          ) : null}

          {isAdmin && activeSection === "cost_rates" ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold">Cost Rates</h2>
              <ul className="space-y-2">
                {users.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ddd9d0] p-3">
                    <div className="min-w-[220px]">
                      <p className="font-medium text-[#1a2e1f]">{member.name}</p>
                      <p className="text-xs text-[#7a7a70]">{member.email}</p>
                    </div>
                    <form action={updateCostRate} className="flex items-center gap-2">
                      <input name="firmSlug" type="hidden" value={firmSlug} />
                      <input name="userId" type="hidden" value={member.id} />
                      <input
                        className="input !w-36"
                        defaultValue={member.costRate ? Number(member.costRate).toFixed(2) : ""}
                        min="0"
                        name="costRate"
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                      />
                      <button className="button-secondary px-3" type="submit">Save</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {isAdmin && activeSection === "billing_rates" ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold">Billing Rates</h2>
              <div className="rounded-lg border border-[#ddd9d0] bg-[#fbfaf7] p-3">
                <h3 className="text-sm font-semibold text-[#1a2e1f]">Missing Workstream Rates</h3>
                <p className="mt-1 text-xs text-[#7a7a70]">
                  Optional shortcut only. Workstreams with the same name can still have different rates by client.
                </p>
                {missingWorkstreamGroups.size === 0 ? (
                  <p className="mt-2 text-sm text-[#7a7a70]">No missing workstream rates.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {[...missingWorkstreamGroups.values()]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((group) => (
                        <li key={group.name} className="rounded-md border border-[#ddd9d0] bg-white p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-[#1a2e1f]">{group.name}</p>
                              <p className="text-xs text-[#7a7a70]">
                                Missing for {group.count} workstream{group.count === 1 ? "" : "s"} across {group.clients.length} client{group.clients.length === 1 ? "" : "s"}
                              </p>
                              <p className="text-xs text-[#7a7a70]">{group.clients.slice(0, 5).join(", ")}{group.clients.length > 5 ? "..." : ""}</p>
                            </div>
                            <form action={applyRateToMissingWorkstreamName} className="flex items-center gap-2">
                              <input name="firmSlug" type="hidden" value={firmSlug} />
                              <input name="workstreamName" type="hidden" value={group.name} />
                              <input className="input !w-36" inputMode="decimal" name="rate" placeholder="Set rate" type="text" />
                              <button className="button px-4" type="submit">Optional bulk apply</button>
                            </form>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              <ul className="space-y-3">
                {billableClients.map((client) => {
                  const clientWorkstreams = sortedWorkstreams.filter((workstream) => workstream.clientId === client.id);
                  return (
                    <li key={client.id} className="rounded-lg border border-[#ddd9d0] bg-[#f7f4ef]">
                      <details>
                        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-[#1a2e1f] [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#7a7a70]">▸</span>
                            <div>
                              <p className="font-semibold">{client.name}</p>
                              <p className="text-xs text-[#7a7a70]">{clientWorkstreams.length} workstreams</p>
                            </div>
                          </div>
                          <span className="text-xs text-[#7a7a70]">Expand</span>
                        </summary>

                        <div className="space-y-3 border-t border-[#ddd9d0] px-3 pb-3 pt-3">
                          <form action={applyRateToAllWorkstreams} className="flex flex-wrap items-center gap-2">
                            <input name="firmSlug" type="hidden" value={firmSlug} />
                            <input name="clientId" type="hidden" value={client.id} />
                            <input className="input !w-36" inputMode="decimal" name="rate" placeholder="Apply to all" type="text" />
                            <button className="button px-4" type="submit">Apply to all workstreams</button>
                          </form>

                          <ul className="space-y-2 rounded-lg border border-[#ddd9d0] bg-white p-3">
                            {clientWorkstreams.length === 0 ? (
                              <li className="text-sm text-[#7a7a70]">No workstreams for this client yet.</li>
                            ) : (
                              clientWorkstreams.map((workstream) => (
                                <li key={workstream.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#ede9e1] px-3 py-2">
                                  <div className="min-w-[220px]">
                                    <p className="font-medium text-[#1a2e1f]">{workstream.name}</p>
                                  </div>
                                  <form action={updateWorkstreamBillingRate} className="flex items-center gap-2">
                                    <input name="firmSlug" type="hidden" value={firmSlug} />
                                    <input name="workstreamId" type="hidden" value={workstream.id} />
                                    <input
                                      className="input !w-36"
                                      defaultValue={workstream.billingRate ? Number(workstream.billingRate).toFixed(2) : ""}
                                      min="0"
                                      name="rate"
                                      placeholder="Workstream rate"
                                      step="0.01"
                                      type="number"
                                    />
                                    <button className="button-secondary px-3" type="submit">Save</button>
                                  </form>
                                </li>
                              ))
                            )}
                          </ul>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {isAdmin && activeSection === "firm_workstreams" ? (
            <section className="card space-y-3">
              <h2 className="text-lg font-semibold">Firm Workstreams</h2>
              <p className="text-sm text-[#7a7a70]">
                Internal non-billable workstreams used for Firm Work timers.
              </p>
              <form action={createFirmWorkstream} className="flex flex-wrap items-center gap-2">
                <input name="firmSlug" type="hidden" value={firmSlug} />
                <input className="input !w-72" name="name" placeholder="New firm workstream name" required />
                <button className="button px-4" type="submit">Add firm workstream</button>
              </form>
              <ul className="space-y-2 rounded-lg border border-[#ddd9d0] bg-[#fbfaf7] p-3">
                {firmWorkstreams.map((workstream) => (
                  <li key={workstream.id} className="rounded-md border border-[#ddd9d0] bg-white px-3 py-2 text-sm text-[#1a2e1f]">
                    {workstream.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {isAdmin && activeSection === "period_locking" ? (
            <>
              <section className="card space-y-3">
                <h2 className="text-lg font-semibold">Lock month</h2>
                <form action={lockPeriod} className="flex flex-wrap gap-2">
                  <input name="firmSlug" type="hidden" value={firmSlug} />
                  <input className="input max-w-xs" name="period" required type="month" />
                  <button className="button" type="submit">Lock period</button>
                </form>
              </section>
              <section className="card">
                <h2 className="text-lg font-semibold">Locked period history</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-2">Period</th>
                        <th className="py-2">Locked by</th>
                        <th className="py-2">Locked at</th>
                        <th className="py-2">Status</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lockedPeriods.map((period) => (
                        <tr key={period.id} className="border-b border-slate-100">
                          <td className="py-2">{period.periodYear}-{String(period.periodMonth).padStart(2, "0")}</td>
                          <td className="py-2">{userById.get(period.lockedByUserId)?.name ?? "Unknown user"}</td>
                          <td className="py-2">{period.lockedAt.toLocaleString()}</td>
                          <td className="py-2">{period.unlockedAt ? "Unlocked" : "Locked"}</td>
                          <td className="py-2">
                            {!period.unlockedAt ? (
                              <form action={unlockPeriod}>
                                <input name="firmSlug" type="hidden" value={firmSlug} />
                                <input name="lockId" type="hidden" value={period.id} />
                                <button className="button-secondary" type="submit">Unlock</button>
                              </form>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
