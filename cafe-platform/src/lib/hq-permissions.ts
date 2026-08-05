import type { PlatformRole } from "@prisma/client";

/**
 * HQ capability matrix — HQ-PORTAL-SPEC.md §1. Hiding a button is not
 * security: every mutating `/api/admin/*` route must also call `canHq()`.
 */
const MATRIX = {
  viewDashboard: ["super_admin", "ops", "support"],
  provisionCafe: ["super_admin", "ops"],
  editBranding: ["super_admin", "ops"],
  generateQr: ["super_admin", "ops"],
  impersonate: ["super_admin", "ops", "support"],
  changeSubscription: ["super_admin"],
  suspendOrDeleteCafe: ["super_admin"],
  resetCafeUserPassword: ["super_admin", "ops", "support"],
  readActivity: ["super_admin", "ops", "support"],
  managePlatformUsers: ["super_admin"],
  manageTemplates: ["super_admin", "ops"],
  supportInbox: ["super_admin", "ops", "support"],
} as const satisfies Record<string, readonly PlatformRole[]>;

export type HqCapability = keyof typeof MATRIX;

export function canHq(role: PlatformRole, capability: HqCapability): boolean {
  return (MATRIX[capability] as readonly PlatformRole[]).includes(role);
}
