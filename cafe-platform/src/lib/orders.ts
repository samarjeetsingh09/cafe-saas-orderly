import { Prisma, type PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { confirmationToken } from "@/lib/tokens";
import { allowInWindow } from "@/lib/rate-limit";

/**
 * Shared order-creation pipeline for cash (M4) and online (M5) modes.
 * Security doc 5.6/3.3: prices + availability re-read from the DB here,
 * never trusted from the client; order_number is sequential per cafe via
 * a pg advisory lock.
 */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const MAX_ORDERS_PER_TABLE_PER_MINUTE = 5;
const RESUBMIT_WINDOW_MS = 45 * 1000;

export type OrderInput = {
  tableToken?: unknown;
  sessionToken?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  items?: unknown;
};

export type CreateOrderResult =
  | {
      ok: true;
      duplicate: boolean;
      order: {
        id: string;
        orderNumber: number;
        confirmationToken: string;
        totalAmountPaise: number;
        sessionToken: string;
      };
    }
  | { ok: false; status: number; error: string; soldOutItemIds?: string[] };

export async function createCustomerOrder(
  input: OrderInput,
  paymentMode: PaymentMode,
): Promise<CreateOrderResult> {
  const tableToken = typeof input.tableToken === "string" ? input.tableToken : "";
  const sessionToken = typeof input.sessionToken === "string" ? input.sessionToken : "";
  const customerName = typeof input.customerName === "string" ? input.customerName.trim() : "";
  const customerPhone = typeof input.customerPhone === "string" ? input.customerPhone.trim() : "";

  if (!tableToken || !sessionToken || sessionToken.length < 12) {
    return { ok: false, status: 400, error: "Invalid request" };
  }
  if (!customerName || customerName.length > 60) {
    return { ok: false, status: 400, error: "Please enter your name" };
  }
  if (!INDIAN_MOBILE.test(customerPhone)) {
    return { ok: false, status: 400, error: "Please enter a valid 10-digit mobile number" };
  }

  const rawItems = Array.isArray(input.items)
    ? (input.items as { menuItemId?: unknown; quantity?: unknown }[])
    : [];
  const items = rawItems.filter(
    (i): i is { menuItemId: string; quantity: number } =>
      !!i &&
      typeof i.menuItemId === "string" &&
      Number.isInteger(i.quantity) &&
      (i.quantity as number) > 0 &&
      (i.quantity as number) <= 50,
  );
  if (items.length === 0 || items.length !== rawItems.length || items.length > 50) {
    return { ok: false, status: 400, error: "Your cart looks empty. Add items and try again." };
  }

  const table = await prisma.table.findUnique({
    where: { qrToken: tableToken },
    select: { id: true, cafeId: true, cafe: { select: { menuEnabled: true } } },
  });
  if (!table) {
    return { ok: false, status: 404, error: "This QR code didn't work. Please scan again." };
  }
  if (!table.cafe.menuEnabled) {
    return {
      ok: false,
      status: 403,
      error: "This menu is temporarily unavailable. Please ask the staff for assistance.",
    };
  }

  // Edge Case #10: cap orders per table per minute.
  if (!allowInWindow(`orders:${table.id}`, MAX_ORDERS_PER_TABLE_PER_MINUTE, 60_000)) {
    return {
      ok: false,
      status: 429,
      error: "Too many orders from this table right now. Please wait a moment.",
    };
  }

  // Double-submit (Security doc 5.10): quick re-post from the same session
  // gets the already-created order back instead of a duplicate.
  const recent = await prisma.order.findFirst({
    where: {
      customerSessionToken: sessionToken,
      createdAt: { gte: new Date(Date.now() - RESUBMIT_WINDOW_MS) },
    },
    select: { id: true, orderNumber: true, confirmationToken: true, totalAmount: true },
  });
  if (recent) {
    return {
      ok: true,
      duplicate: true,
      order: {
        id: recent.id,
        orderNumber: recent.orderNumber,
        confirmationToken: recent.confirmationToken,
        totalAmountPaise: recent.totalAmount.mul(100).toNumber(),
        sessionToken,
      },
    };
  }

  // Re-fetch live items: must exist, belong to this cafe, and be available.
  const ids = items.map((i) => i.menuItemId);
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, cafeId: table.cafeId },
    select: { id: true, name: true, price: true, isAvailable: true },
  });
  const byId = new Map(dbItems.map((i) => [i.id, i]));

  if (dbItems.length !== new Set(ids).size) {
    return {
      ok: false,
      status: 409,
      error: "Some items are no longer on the menu. Please review your cart.",
    };
  }
  const soldOut = dbItems.filter((i) => !i.isAvailable);
  if (soldOut.length > 0) {
    return {
      ok: false,
      status: 409,
      error: `Just sold out: ${soldOut.map((i) => i.name).join(", ")}. Please remove and try again.`,
      soldOutItemIds: soldOut.map((i) => i.id),
    };
  }

  const lines = items.map((i) => {
    const db = byId.get(i.menuItemId)!;
    return {
      menuItemId: db.id,
      itemNameSnapshot: db.name,
      itemPriceSnapshot: db.price,
      quantity: i.quantity,
      subtotal: db.price.mul(i.quantity),
    };
  });
  const totalAmount = lines.reduce((s, l) => s.add(l.subtotal), new Prisma.Decimal(0));

  const order = await prisma.$transaction(async (tx) => {
    // Advisory lock serializes numbering per cafe — safe under concurrency,
    // released automatically at transaction end.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${table.cafeId}::text))`;
    const [{ next }] = await tx.$queryRaw<[{ next: number }]>`
      SELECT COALESCE(MAX(order_number), 0) + 1 AS next FROM orders WHERE cafe_id = ${table.cafeId}::uuid
    `;
    return tx.order.create({
      data: {
        cafeId: table.cafeId,
        tableId: table.id,
        orderNumber: Number(next),
        customerSessionToken: sessionToken,
        confirmationToken: confirmationToken(),
        customerName,
        customerPhone,
        paymentMode,
        paymentStatus: paymentMode === "cash" ? "cash_pending" : "payment_pending",
        totalAmount,
        orderItems: { create: lines },
      },
      select: { id: true, orderNumber: true, confirmationToken: true },
    });
  });

  return {
    ok: true,
    duplicate: false,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      confirmationToken: order.confirmationToken,
      totalAmountPaise: totalAmount.mul(100).toNumber(),
      sessionToken,
    },
  };
}
