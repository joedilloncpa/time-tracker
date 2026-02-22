import { prisma } from "@/lib/db";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateUniqueSlug(firmName: string): Promise<string> {
  const base = slugify(firmName);
  if (!base) {
    throw new Error("Firm name produces an empty slug");
  }

  const existing = await prisma.tenant.findUnique({ where: { slug: base } });
  if (!existing) {
    return base;
  }

  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    const collision = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!collision) {
      return candidate;
    }
  }

  throw new Error("Unable to generate unique slug for this firm name");
}
