import { UserRole } from "@prisma/client";

export type TenantSettingsShape = {
  userClientPermissions?: Record<string, string[]>;
};

export function normalizeTenantSettings(value: unknown): TenantSettingsShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as { userClientPermissions?: unknown };
  const next: TenantSettingsShape = {};

  if (raw.userClientPermissions && typeof raw.userClientPermissions === "object" && !Array.isArray(raw.userClientPermissions)) {
    const permissionMap: Record<string, string[]> = {};
    for (const [userId, clientIds] of Object.entries(raw.userClientPermissions as Record<string, unknown>)) {
      if (!Array.isArray(clientIds)) {
        continue;
      }
      permissionMap[userId] = [...new Set(clientIds.map((id) => String(id).trim()).filter(Boolean))];
    }
    next.userClientPermissions = permissionMap;
  }

  return next;
}

export function getAllowedClientIdsForUser(
  settingsJson: unknown,
  userId: string,
  role: UserRole
): string[] | null {
  if (role === "firm_admin" || role === "super_admin") {
    return null;
  }

  const settings = normalizeTenantSettings(settingsJson);
  const ids = settings.userClientPermissions?.[userId];
  return ids ?? null;
}

export function withUserClientPermissions(
  settingsJson: unknown,
  userId: string,
  clientIds: string[] | null
): TenantSettingsShape {
  const settings = normalizeTenantSettings(settingsJson);
  const nextMap = { ...(settings.userClientPermissions ?? {}) };

  if (clientIds === null) {
    delete nextMap[userId];
  } else {
    nextMap[userId] = [...new Set(clientIds.map((id) => id.trim()).filter(Boolean))];
  }

  return {
    ...settings,
    userClientPermissions: nextMap
  };
}
