import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { confirmationToken } from "@/lib/tokens";
import { CUSTOMER_COOKIE } from "@/lib/customer-session";
import { allowInWindow } from "@/lib/rate-limit";

/**
 * Order placement, cash mode (M4). Security doc 5.6/3.3/3.2:
 * prices and availability re-read from DB at placement, phone validated
 * server-side, order_number sequential per cafe (advisory lock), session
 * token echoed into an httpOnly cookie so only this browser can open the
 * confirmation page.
 */

const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const MAX_ORDERS_PER_TABLE_PER_MINUTE = 5;
const RESUBMIT_WINDOW_MS = 45 * 1000;

type ItemInput = { menuItemId: string; quantity: number };

export async function POST(request: Request) {
  let body: {
    tableToken?: unknown;
    sessionToken?: unknown;
    customerName?: unknown;
    customerPhone?: unknown;
    paymentMode?: unknown;
    items?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const tableToken = typeof body.tableToken === "string" ? body.tableToken : "";
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken : "";
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";

  if (!tableToken || !sessionToken || sessionToken.length < 12) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!customerName || customerName.length > 60) {
    return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
  }
  if (!INDIAN_MOBILE.test(customerPhone)) {
    return NextResponse.json(
      { error: "Please enter a valid 10-digit mobile number" },
      { status: 400 },
    );
  }
  if (body.paymentMode !== "cash") {
    // Online mode arrives in M5.
    return NextResponse.json({ error: "Unsupported payment mode" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? (body.items as ItemInput[]) : [];
  const items = rawItems.filter(
    (i) =>
      i &&
      typeof i.menuItemId === "string" &&
      Number.isInteger(i.quantity) &&
      i.quantity > 0 &&
      i.quantity <= 50,
  );
  if (items.length === 0 || items.length !== rawItems.length || items.length > 50) {
    return NextResponse.json({ error: "Your cart looks empty. Add items and try again." }, { status: 400 });
  }

  const table = await prisma.table.findUnique({
    where: { qrToken: tableToken },
    select: { id: true, cafeId: true, cafe: { select: { menuEnabled: true } } },
  });
  if (!table) {
    return NextResponse.json({ error: "This QR code didn't work. Please scan again." }, { status: 404 });
  }
  if (!table.cafe.menuEnabled) {
    return NextResponse.json(
      { error: "This menu is temporarily unavailable. Please ask the staff for assistance." },
      { status: 403 },
    );
  }

  // Edge Case #10: cap orders per table per minute.
  if (!allowInWindow(`orders:${table.id}`, MAX_ORDERS_PER_TABLE_PER_MINUTE, 60_000)) {
    return NextResponse.json(
      { error: "Too many orders from this table right now. Please wait a moment." },
      { status: 429 },
    );
  }

  // Double-submit (Security doc 5.10): same session re-posting quickly gets
  // the already-created order back instead of a duplicate.
  const recent = await prisma.order.findFirst({
    where: {
      customerSessionToken: sessionToken,
      createdAt: { gte: new Date(Date.now() - RESUBMIT_WINDOW_MS) },
    },
    select: { confirmationToken: true },
  });
  if (recent) {
    return withSessionCookie(
      NextResponse.json({ ok: true, confirmationToken: recent.confirmationToken }),
      sessionToken,
    );
  }

  // Re-fetch live items: must exist, belong to this cafe, and be available.
  const ids = items.map((i) => i.menuItemId);
  const dbItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, cafeId: table.cafeId },
    select: { id: true, name: true, price: true, isAvailable: true },
  });
  const byId = new Map(dbItems.map((i) => [i.id, i]));

  if (dbItems.length !== new Set(ids).size) {
    return NextResponse.json(
      { error: "Some items are no longer on the menu. Please review your cart." },
      { status: 409 },
    );
  }
  const soldOut = dbItems.filter((i) => !i.isAvailable);
  if (soldOut.length > 0) {
    return NextResponse.json(
      {
        error: `Just sold out: ${soldOut.map((i) => i.name).join(", ")}. Please remove and try again.`,
        soldOutItemIds: soldOut.map((i) => i.id),
      },
      { status: 409 },
    );
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
  const confirmation = confirmationToken();

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
        confirmationToken: confirmation,
        customerName,
        customerPhone,
        paymentMode: "cash",
        paymentStatus: "cash_pending",
        totalAmount,
        orderItems: { create: lines },
      },
      select: { confirmationToken: true, orderNumber: true },
    });
  });

  return withSessionCookie(
    NextResponse.json({ ok: true, confirmationToken: order.confirmationToken }),
    sessionToken,
  );
}

function withSessionCookie(res: NextResponse, sessionToken: string): NextResponse {
  res.cookies.set(CUSTOMER_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/order",
    maxAge: 24 * 60 * 60,
  });
  return res;
}
