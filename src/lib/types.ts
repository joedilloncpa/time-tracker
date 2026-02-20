import { UserRole } from "@prisma/client";

export type UserContext = {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  tenantSlug: string | null;
  name: string;
};
