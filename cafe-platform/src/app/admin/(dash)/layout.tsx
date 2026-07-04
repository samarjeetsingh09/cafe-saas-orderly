import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";

/** DB-backed guard for every admin page (see owner counterpart). */
export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return <>{children}</>;
}
