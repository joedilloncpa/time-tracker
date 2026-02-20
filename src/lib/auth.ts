import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { UserContext } from "@/lib/types";

function parseRole(value: string | undefined): UserRole {
  if (value === "super_admin" || value === "firm_admin" || value === "firm_user") {
    return value;
  }
  return "firm_user";
}

async function getDevContext(firmSlug?: string): Promise<UserContext> {
  if (!firmSlug) {
    const superAdmin = await prisma.user.findFirst({
      where: { role: "super_admin", isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (superAdmin) {
      return {
        id: superAdmin.id,
        email: superAdmin.email,
        role: superAdmin.role,
        tenantId: superAdmin.tenantId,
        tenantSlug: null,
        name: superAdmin.name
      };
    }
  }

  const tenant = firmSlug
    ? await prisma.tenant.findUnique({ where: { slug: firmSlug } })
    : await prisma.tenant.findFirst();

  if (!tenant) {
    throw new Error("No tenant found. Run prisma seed first.");
  }

  const firstUser = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (!firstUser) {
    throw new Error("No users found. Run prisma seed first.");
  }

  return {
    id: firstUser.id,
    email: firstUser.email,
    role: firstUser.role,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    name: firstUser.name
  };
}

export async function getUserContext(firmSlug?: string): Promise<UserContext> {
  if (process.env.AUTH_MODE === "dev") {
    return getDevContext(firmSlug);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase auth environment variables are missing");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookieValues) {
          cookieValues.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user: supabaseUser }
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    throw new Error("Unauthorized");
  }

  const dbUser = await prisma.user.findFirst({
    where: {
      OR: [
        { supabaseAuthId: supabaseUser.id },
        { email: supabaseUser.email?.toLowerCase() }
      ]
    },
    include: {
      tenant: true
    }
  });

  if (!dbUser) {
    throw new Error("User not provisioned");
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    role: parseRole(dbUser.role),
    tenantId: dbUser.tenantId,
    tenantSlug: dbUser.tenant?.slug ?? null,
    name: dbUser.name
  };
}
