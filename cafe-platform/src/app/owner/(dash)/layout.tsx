import { redirect } from "next/navigation";
import { getOwnerCafe } from "@/lib/session";

/**
 * DB-backed guard for every owner dashboard page (proxy.ts only checks the
 * JWT signature). Re-reads the cafe row, so a deactivated cafe's session
 * dies on its next request — BUILD_PLAN M2 session invalidation.
 */
export default async function OwnerDashLayout({ children }: { children: React.ReactNode }) {
  const cafe = await getOwnerCafe();
  if (!cafe) redirect("/owner/login");
  return <>{children}</>;
}
