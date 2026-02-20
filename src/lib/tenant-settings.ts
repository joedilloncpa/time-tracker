import { UserRole } from "@prisma/client";

export type TenantSettingsShape = {
  userClientPermissions?: Record<string, string[]>;
  inviteDeliveryByUserId?: Record<string, { lastAttemptAt?: string; lastSentAt?: string; lastError?: string | null }>;
};

export function normalizeTenantSettings(value: unknown): TenantSettingsShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as { userClientPermissions?: unknown; inviteDeliveryByUserId?: unknown };
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

  if (raw.inviteDeliveryByUserId && typeof raw.inviteDeliveryByUserId === "object" && !Array.isArray(raw.inviteDeliveryByUserId)) {
    const inviteMap: Record<string, { lastAttemptAt?: string; lastSentAt?: string; lastError?: string | null }> = {};
    for (const [userId, value] of Object.entries(raw.inviteDeliveryByUserId as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      const item = value as { lastAttemptAt?: unknown; lastSentAt?: unknown; lastError?: unknown };
      inviteMap[userId] = {
        ...(typeof item.lastAttemptAt === "string" ? { lastAttemptAt: item.lastAttemptAt } : {}),
        ...(typeof item.lastSentAt === "string" ? { lastSentAt: item.lastSentAt } : {}),
        ...(item.lastError === null || typeof item.lastError === "string" ? { lastError: item.lastError } : {})
      };
    }
    next.inviteDeliveryByUserId = inviteMap;
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

export function withInviteDeliveryStatus(
  settingsJson: unknown,
  userId: string,
  status: { lastAttemptAt?: string; lastSentAt?: string; lastError?: string | null } | null
): TenantSettingsShape {
  const settings = normalizeTenantSettings(settingsJson);
  const nextMap = { ...(settings.inviteDeliveryByUserId ?? {}) };

  if (status === null) {
    delete nextMap[userId];
  } else {
    nextMap[userId] = {
      ...(status.lastAttemptAt ? { lastAttemptAt: status.lastAttemptAt } : {}),
      ...(status.lastSentAt ? { lastSentAt: status.lastSentAt } : {}),
      ...(status.lastError === undefined ? {} : { lastError: status.lastError })
    };
  }

  return {
    ...settings,
    inviteDeliveryByUserId: nextMap
  };
}
