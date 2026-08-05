import { NextResponse } from "next/server";
import { getMenuManagerData } from "@/lib/owner-menu";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";

/** Powers the "Take an order" POS modal's dish picker — fetched on demand, not preloaded on every page. */
export async function GET() {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }
  if (!can(profile.role, "takeOrder")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const categories = await getMenuManagerData(profile.tenantId);
  return NextResponse.json({ categories, gstPercent: Number(profile.tenant.gstPercent) });
}
