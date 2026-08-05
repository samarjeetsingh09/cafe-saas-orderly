"use client";

import { useState } from "react";
import type { CustomerCategoryDTO } from "@/lib/menu";
import { useEventStream, type StreamMessage } from "@/hooks/useEventStream";

/**
 * Live `menu_items.available` updates for the customer menu (Phase G
 * Checkpoint: "86 a dish and the customer menu greys it out live"). A
 * browsing customer hasn't placed an order yet, so this can't reuse
 * `useLiveOrders`'s order-scoped stream — it subscribes with just `qrToken`
 * (see `src/app/api/stream/route.ts`'s third branch), which is filtered
 * server-side to `menu.updated` only, never order data.
 */
export function useMenuAvailability(initialCategories: CustomerCategoryDTO[], qrToken: string) {
  const [categories, setCategories] = useState(initialCategories);

  useEventStream(`/api/stream?qrToken=${qrToken}`, (msg: StreamMessage) => {
    if (msg.event !== "menu.updated") return;
    const { itemId, available } = msg.payload as { itemId: string; available: boolean };
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === itemId ? { ...i, available } : i)),
      }))
    );
  });

  return categories;
}
