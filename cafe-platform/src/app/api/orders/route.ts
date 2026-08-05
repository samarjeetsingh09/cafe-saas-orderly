import { NextResponse } from "next/server";
import { createOrder, CreateOrderInput } from "@/lib/orders";
import { getProfile } from "@/lib/session";
import { can } from "@/lib/permissions";
import { auditIfImpersonated } from "@/lib/impersonation-audit";

/**
 * plan/BUILD-SPEC.md §9 `POST /api/orders`. `channel: 'qr'` needs no staff
 * auth — anyone with a valid table token can order, same as scanning a real
 * QR code. `channel: 'staff'` (the "Take an order" POS, Phase H) is
 * session-authenticated and requires the `takeOrder` capability;
 * `tableId`/`payMethod` come from the request but the session supplies
 * `tenantId`/`placedBy` — never trust those from the client.
 * `lib/orders.ts` re-reads every price from the DB either way.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = CreateOrderInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.channel === "staff") {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    }
    if (!can(profile.role, "takeOrder")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    const result = await createOrder(parsed.data, { tenantId: profile.tenantId, profileId: profile.id });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, unavailableNames: result.unavailableNames }, { status: result.status });
    }
    await auditIfImpersonated(profile, "order.taken", `took order ${result.order.code} for table ${result.order.tableLabel}`, { orderId: result.order.id });
    return NextResponse.json({ order: result.order }, { status: 201 });
  }

  const result = await createOrder(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, unavailableNames: result.unavailableNames }, { status: result.status });
  }
  return NextResponse.json({ order: result.order }, { status: 201 });
}
