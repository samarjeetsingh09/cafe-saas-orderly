import { redirect } from "next/navigation";
import { getQrOrigin } from "@/lib/app-url";
import { getProfile } from "@/lib/session";
import { getQrTables } from "@/lib/owner-qr";
import { QrCodes } from "@/components/owner/QrCodes";
import { can } from "@/lib/permissions";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/owner/login");
  if (!can(profile.role, "viewQrCodes")) redirect("/owner/orders");

  const [tables, origin] = await Promise.all([getQrTables(profile.tenantId), getQrOrigin()]);

  return (
    <QrCodes
      tenantName={profile.tenant.name}
      tenantSlug={profile.tenant.slug}
      origin={origin}
      tables={tables}
      theme={profile.tenant.theme as Record<string, unknown>}
    />
  );
}
