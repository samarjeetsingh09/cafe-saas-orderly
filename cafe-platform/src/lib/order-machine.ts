import type { OrderStage, ProfileRole } from "@prisma/client";

/**
 * Single source of truth for order stage transitions — plan/BUILD-SPEC.md §8.
 * Console and kitchen (Phase G) both import this; never re-implement the
 * rules in a component.
 */
export const NEXT: Partial<Record<OrderStage, OrderStage>> = {
  new: "preparing",
  preparing: "ready",
  ready: "served",
};

export const BACK: Partial<Record<OrderStage, OrderStage>> = {
  preparing: "new",
  ready: "preparing",
  served: "ready",
};

export const STAMP: Partial<Record<OrderStage, "acceptedAt" | "readyAt" | "servedAt">> = {
  preparing: "acceptedAt",
  ready: "readyAt",
  served: "servedAt",
};

export const STAGE_LABEL: Record<OrderStage, string> = {
  new: "New",
  preparing: "In the kitchen",
  ready: "Ready to serve",
  served: "Served",
  cancelled: "Cancelled",
};

export const NEXT_ACTION_LABEL: Partial<Record<OrderStage, string>> = {
  new: "Accept",
  preparing: "Mark ready",
  ready: "Mark served",
};

export function canAdvance(role: ProfileRole, from: OrderStage, to: OrderStage): boolean {
  if (to === "cancelled") return role === "owner" || role === "manager";
  if (NEXT[from] !== to && BACK[from] !== to) return false;
  if (role === "kitchen") return to === "preparing" || to === "ready";
  return true;
}
