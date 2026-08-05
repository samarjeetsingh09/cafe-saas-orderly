import { EventEmitter } from "events";

/**
 * In-process pub/sub for realtime — plan/CLAUDE-CODE-BRIEF.md Step 4, the
 * local substitute for Supabase Realtime (NOTES.md decision #1: single Node
 * process, per plan/START-HERE.md's "local only" scope). globalThis-cached
 * like lib/db.ts's Prisma client, so a Next dev HMR reload of this module
 * doesn't orphan SSE subscribers already listening on the old instance.
 */
const globalForBus = globalThis as unknown as { orderlyBus?: EventEmitter };
export const bus = globalForBus.orderlyBus ?? new EventEmitter();
bus.setMaxListeners(0); // many concurrent SSE connections per tenant is normal, not a leak
if (process.env.NODE_ENV !== "production") globalForBus.orderlyBus = bus;

export type BusEventName = "order.created" | "order.updated" | "menu.updated" | "ticket.updated";
export type BusMessage = { event: BusEventName; payload: unknown };

/** Call after a mutation's transaction commits — never before, never speculatively. */
export function emit(tenantId: string, event: BusEventName, payload: unknown): void {
  bus.emit(`t:${tenantId}`, { event, payload } satisfies BusMessage);
}

export function subscribe(tenantId: string, listener: (msg: BusMessage) => void): () => void {
  const channel = `t:${tenantId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}
