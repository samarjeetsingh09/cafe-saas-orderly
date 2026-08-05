import { notFound } from "next/navigation";
import { getPlatformUser } from "@/lib/session";
import { getRailCounts } from "@/lib/hq-dashboard";
import { HqRail } from "@/components/admin/HqRail";
import { ToastHost } from "@/components/admin/ui/Toast";
import "@/styles/hq.css";

/**
 * DB-backed guard for every HQ page (proxy.ts only checks the JWT signature
 * at the edge). 404, not redirect — see proxy.ts and HQ-PORTAL-SPEC.md §1:
 * don't confirm this route exists to a session that isn't platform staff.
 *
 * `.hq` scopes the console's tokens/classes away from the marketing site's
 * Tailwind theme, the same containment Phase D used for `.console`.
 */
export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const user = await getPlatformUser();
  if (!user) notFound();

  const counts = await getRailCounts();

  return (
    <div className="hq">
      <ToastHost>
        <div className="hq-shell">
          <HqRail
            fullName={user.fullName}
            role={user.role}
            openTickets={counts.openTickets}
            attention={counts.attention}
          />
          <main className="hq-main">{children}</main>
        </div>
      </ToastHost>
    </div>
  );
}
