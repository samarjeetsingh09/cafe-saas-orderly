"use client";

import { useState } from "react";
import type { BoardOrderDTO } from "@/lib/owner-board";
import { useEventStream, type StreamMessage } from "@/hooks/useEventStream";

/**
 * The one sync path for order data — plan/CLAUDE-CODE-BRIEF.md Step 4:
 * "the console, the kitchen and the customer tracker all use this one hook
 * ... do not write a second sync path for staff-punched orders." Console
 * (Phase D), the customer tracker (Phase F) and the kitchen board (Phase G)
 * all call this — kitchen reuses `BoardOrderDTO` as-is since it already has
 * everything a ticket needs (code, table, stage, items, note, readyAt).
 *
 * Seeds from `initialOrders` (already fetched server-side — no client fetch
 * needed) and applies `order.created`/`order.updated` events from
 * `GET /api/stream` as they arrive. `patchLocal` lets the caller apply its
 * own optimistic mutation through the exact same state, so a locally-clicked
 * change and its own SSE echo can never diverge.
 *
 * `streamUrl` defaults to the full staff tenant stream. The customer tracker
 * passes `/api/stream?orderId=...&qrToken=...`, which the route scopes down
 * to just that one order (see `src/app/api/stream/route.ts`) — same hook,
 * same event shapes, different subscription scope.
 */
export function useLiveOrders(initialOrders: BoardOrderDTO[], streamUrl = "/api/stream") {
  const [orders, setOrders] = useState(initialOrders);

  const { connected } = useEventStream(streamUrl, (msg: StreamMessage) => {
    if (msg.event === "order.created") {
      const created = msg.payload as BoardOrderDTO;
      setOrders((prev) => (prev.some((o) => o.id === created.id) ? prev : [...prev, created]));
    } else if (msg.event === "order.updated") {
      const patch = msg.payload as Partial<BoardOrderDTO> & { id: string };
      setOrders((prev) => prev.map((o) => (o.id === patch.id ? { ...o, ...patch } : o)));
    }
  });

  function patchLocal(id: string, patch: Partial<BoardOrderDTO>) {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  return { orders, patchLocal, connected };
}
