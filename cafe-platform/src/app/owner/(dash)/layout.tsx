import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getNewOrderCount } from "@/lib/owner-board";
import { ThemeStyle, ThemeFonts } from "@/components/theme";
import { ConsoleNav } from "@/components/owner/ConsoleNav";
import { ImpersonationBanner } from "@/components/owner/ImpersonationBanner";
import "@/styles/tokens.css";
import "@/styles/console.css";

/**
 * DB-backed guard for every cafe-staff console page (proxy.ts only checks the
 * JWT signature). Re-reads the profile+tenant row, so a deactivated staff
 * account or a cancelled tenant's still-unexpired JWT dies on its next
 * request.
 *
 * Renders the tenant's theme as CSS vars before any content (no colour
 * flash) and the console shell (Phase D: top bar + tab nav ported from
 * plan/bella-admin-console.html). `.console` scopes the ported class names
 * away from the marketing site's Tailwind classes.
 */
export default async function OwnerDashLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");
  if (profile.role === "kitchen") redirect("/kitchen");

  const newOrderCount = await getNewOrderCount(profile.tenantId);

  return (
    <div className="console" style={{ background: "var(--bg)", color: "var(--ink)", minHeight: "100dvh", fontFamily: "var(--font-body)" }}>
      <ThemeStyle theme={profile.tenant.theme} />
      <ThemeFonts theme={profile.tenant.theme} />
      {profile.impersonatedBy && <ImpersonationBanner fullName={profile.fullName} tenantName={profile.tenant.name} />}
      <ConsoleNav
        tenantName={profile.tenant.name}
        fullName={profile.fullName}
        role={profile.role}
        newOrderCount={newOrderCount}
      />
      <main>{children}</main>
    </div>
  );
}
