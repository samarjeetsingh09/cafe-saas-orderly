import { redirect } from "next/navigation";
import { getProfile } from "@/lib/session";
import { getKitchenTickets, getKitchenMenu } from "@/lib/kitchen";
import { ThemeStyle, ThemeFonts } from "@/components/theme";
import { KitchenDisplay } from "@/components/kitchen/KitchenDisplay";
import "@/styles/tokens.css";
import "@/styles/kitchen.css";

/**
 * Wall-screen kitchen display (Phase G) — standalone, no console chrome.
 * Same staff login as `/owner/*` (`Profile` session covers every role).
 * `force-dynamic`: this must never serve a stale ticket list.
 */
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");

  const [tickets, menu] = await Promise.all([getKitchenTickets(profile.tenantId), getKitchenMenu(profile.tenantId)]);

  return (
    <>
      <ThemeStyle theme={profile.tenant.theme} />
      <ThemeFonts theme={profile.tenant.theme} />
      <KitchenDisplay
        tenantName={profile.tenant.name}
        initialTickets={tickets}
        initialMenu={menu}
        initialStation={profile.station ?? "veg"}
        splitKitchen={profile.tenant.splitKitchen}
      />
    </>
  );
}
