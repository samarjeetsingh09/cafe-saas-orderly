import { NextResponse } from "next/server";
import { createCustomerOrder, type OrderInput } from "@/lib/orders";
import { CUSTOMER_COOKIE } from "@/lib/customer-session";

/** Cash-mode order placement (M4). Online mode goes through /api/payments. */
export async function POST(request: Request) {
  let body: OrderInput & { paymentMode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (body.paymentMode !== "cash") {
    return NextResponse.json({ error: "Unsupported payment mode" }, { status: 400 });
  }

  const result = await createCustomerOrder(body, "cash");
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, soldOutItemIds: result.soldOutItemIds },
      { status: result.status },
    );
  }

  const res = NextResponse.json({ ok: true, confirmationToken: result.order.confirmationToken });
  res.cookies.set(CUSTOMER_COOKIE, result.order.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/order",
    maxAge: 24 * 60 * 60,
  });
  return res;
}
