import type { Metadata } from "next";
import { getMenuBySlug, getTableByToken } from "@/lib/menu";
import { randomToken } from "@/lib/tokens";
import { MenuBrowser } from "@/components/customer/MenuBrowser";
import { InvalidTable, MenuUnavailable } from "@/components/customer/MenuUnavailable";

/**
 * QR target: menu + ordering for one table. The tableToken must exist AND
 * belong to the cafe in the URL — a token pasted under another cafe's slug
 * is rejected. A fresh customer_session_token is minted per page load
 * (Security doc 3.2 Risk 1).
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cafeSlug: string; tableToken: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cafeSlug } = await params;
  const menu = await getMenuBySlug(cafeSlug);
  return { title: menu ? `${menu.cafeName} — Order` : "Order" };
}

export default async function Page({ params }: Props) {
  const { cafeSlug, tableToken } = await params;

  const [menu, table] = await Promise.all([getMenuBySlug(cafeSlug), getTableByToken(tableToken)]);
  if (!menu) return <InvalidTable />;
  if (!table || table.cafe.slug !== cafeSlug) return <InvalidTable />;
  if (!menu.menuEnabled) return <MenuUnavailable />;

  return (
    <MenuBrowser
      menu={menu}
      table={{ token: tableToken, number: table.tableNumber }}
      sessionToken={randomToken()}
    />
  );
}
