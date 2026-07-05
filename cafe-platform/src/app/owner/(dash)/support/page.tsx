import { prisma } from "@/lib/db";
import { getOwnerCafe } from "@/lib/session";
import { SupportBox, type SupportQueryDTO } from "@/components/owner/SupportBox";

export const dynamic = "force-dynamic";

export default async function OwnerSupportPage() {
  const cafe = (await getOwnerCafe())!;
  const rows = await prisma.supportQuery.findMany({
    where: { cafeId: cafe.id },
    orderBy: { createdAt: "desc" },
  });
  const queries: SupportQueryDTO[] = rows.map((q) => ({
    id: q.id,
    message: q.message,
    status: q.status,
    createdAt: q.createdAt.toISOString(),
    resolvedAt: q.resolvedAt?.toISOString() ?? null,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Support</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Ask us anything — we reply on your registered phone.</p>
      <SupportBox initialQueries={queries} />
    </div>
  );
}
