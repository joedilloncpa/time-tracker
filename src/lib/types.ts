import { UserRole } from "@prisma/client";

export type UserContext = {
  id: string;
  email: string;
  authRole: UserRole;
  role: UserRole;
  isSuperAdmin: boolean;
  tenantId: string | null;
  tenantSlug: string | null;
  name: string;
};
