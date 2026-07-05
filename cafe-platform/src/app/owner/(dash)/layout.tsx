import { redirect } from "next/navigation";
import { getOwnerCafe } from "@/lib/session";
import { OwnerNav } from "@/components/owner/OwnerNav";

/**
 * DB-backed guard for every owner dashboard page (proxy.ts only checks the
 * JWT signature). Re-reads the cafe row, so a deactivated cafe's session
 * dies on its next request — BUILD_PLAN M2 session invalidation.
 *
 * Also the M6 dashboard shell: desktop sidebar / mobile bottom tab bar.
 * Owner surfaces use a neutral slate base with --primary as the only accent
 * (DESIGN_SYSTEM 4.2), distinct from the warm customer palette.
 */
export default async function OwnerDashLayout({ children }: { children: React.ReactNode }) {
  const cafe = await getOwnerCafe();
  if (!cafe) redirect("/owner/login");
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <OwnerNav cafeName={cafe.name} />
      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 md:px-8 md:py-10">{children}</div>
      </main>
    </div>
  );
}
