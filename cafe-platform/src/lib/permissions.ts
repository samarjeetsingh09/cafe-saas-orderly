import type { ProfileRole } from "@prisma/client";

/**
 * Capability matrix — BUILD-SPEC.md §5.4. Hiding a nav item or button is not
 * security: every mutating route must also call `can()` server-side. QR
 * generation deliberately has no row here — it doesn't exist as a cafe-side
 * capability at all; codes are issued by HQ only.
 */
const MATRIX = {
  seeLiveOrders: ["owner", "manager", "waiter", "kitchen"],
  advanceStage: ["owner", "manager", "waiter", "kitchen"],
  takeOrder: ["owner", "manager", "waiter"],
  settleCash: ["owner", "manager", "waiter"],
  toggleAvailability: ["owner", "manager", "kitchen"],
  editMenu: ["owner", "manager"],
  viewReports: ["owner", "manager"],
  manageBilling: ["owner"],
  viewQrCodes: ["owner", "manager"],
} as const satisfies Record<string, readonly ProfileRole[]>;

export type Capability = keyof typeof MATRIX;

export function can(role: ProfileRole, capability: Capability): boolean {
  return (MATRIX[capability] as readonly ProfileRole[]).includes(role);
}
