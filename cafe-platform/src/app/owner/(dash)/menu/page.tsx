import { getOwnerCafe } from "@/lib/session";
import { getOwnerMenu } from "@/lib/owner-menu";
import { MenuManager } from "@/components/owner/MenuManager";

export const dynamic = "force-dynamic";

export default async function OwnerMenuPage() {
  const cafe = (await getOwnerCafe())!;
  const categories = await getOwnerMenu(cafe.id);
  return <MenuManager initialCategories={categories} />;
}
