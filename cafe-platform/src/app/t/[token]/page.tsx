import { resolveTable, getCustomerMenu } from "@/lib/menu";
import { ThemeStyle, ThemeFonts } from "@/components/theme";
import { OrderingApp } from "@/components/customer/OrderingApp";
import { InvalidTable, MenuUnavailable } from "@/components/customer/MenuUnavailable";
import "@/styles/tokens.css";
import "@/styles/ordering.css";

/**
 * Customer entry point — plan/BUILD-SPEC.md's `/t/{qr_token}` URL scheme
 * (Phase F). `force-dynamic`: table/item availability can change between
 * scans, this must never serve a cached menu.
 */
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveTable(token);
  if (!resolved) return <InvalidTable />;
  if (!resolved.ordersOpen) return <MenuUnavailable />;

  const categories = await getCustomerMenu(resolved.tenantId);

  return (
    <>
      <ThemeStyle theme={resolved.theme} />
      <ThemeFonts theme={resolved.theme} />
      <OrderingApp
        tenantName={resolved.tenantName}
        tenantTagline={resolved.tenantTagline}
        tenantSlug={resolved.tenantSlug}
        tableLabel={resolved.tableLabel}
        qrToken={token}
        gstPercent={resolved.gstPercent}
        categories={categories}
      />
    </>
  );
}
