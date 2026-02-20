import { UserRole } from "@prisma/client";
import { UserContext } from "@/lib/types";

export function ensureRole(user: UserContext, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
}

export function canManageTeam(user: UserContext) {
  return user.role === "firm_admin" || user.role === "super_admin";
}

export function canViewCostRates(user: UserContext) {
  return user.role === "firm_admin" || user.role === "super_admin";
}
