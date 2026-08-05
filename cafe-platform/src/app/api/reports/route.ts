import { NextResponse } from "next/server";
import { getReportsDays } from "@/lib/owner-reports";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { can } from "@/lib/permissions";

export async function GET(request: Request) {
  let profile;
  try {
    profile = await requireProfile();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Staff session required" }, { status: 401 });
    throw e;
  }
  if (!can(profile.role, "viewReports")) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const range = Number(new URL(request.url).searchParams.get("range"));
  if (range !== 7 && range !== 14 && range !== 30) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const days = await getReportsDays(profile.tenantId, range);
  return NextResponse.json({ days });
}
