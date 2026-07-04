import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMenuBySlug } from "@/lib/menu";
import { MenuBrowser } from "@/components/customer/MenuBrowser";
import { MenuUnavailable } from "@/components/customer/MenuUnavailable";

/** View-only menu — the cafe's shareable marketing link. No ordering. */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ cafeSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cafeSlug } = await params;
  const menu = await getMenuBySlug(cafeSlug);
  return { title: menu ? `${menu.cafeName} — Menu` : "Menu" };
}

export default async function Page({ params }: Props) {
  const { cafeSlug } = await params;
  const menu = await getMenuBySlug(cafeSlug);
  if (!menu) notFound();
  if (!menu.menuEnabled) return <MenuUnavailable />;
  return <MenuBrowser menu={menu} />;
}
