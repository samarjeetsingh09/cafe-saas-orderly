import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EditCafeForm } from "@/components/admin/EditCafeForm";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ cafeId: string }> }) {
  const { cafeId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: cafeId },
    select: {
      id: true, name: true, slug: true, tagline: true, phone: true, address: true,
      gstNumber: true, gstPercent: true, splitKitchen: true, theme: true, logoUrl: true, deletedAt: true,
    },
  });
  if (!tenant || tenant.deletedAt) notFound();

  const versions = await prisma.themeVersion.findMany({
    where: { tenantId: cafeId },
    orderBy: { savedAt: "desc" },
    take: 10,
    include: { savedBy: { select: { fullName: true, email: true } } },
  });

  return (
    <>
      <PageHeader title={`Edit ${tenant.name}`} subtitle="Changes go live on the customer menu immediately" back={{ href: `/admin/cafes/${tenant.id}`, label: tenant.name }} />
      <EditCafeForm
        tenant={{
          id: tenant.id,
          name: tenant.name,
          tagline: tenant.tagline,
          phone: tenant.phone,
          address: tenant.address,
          gstNumber: tenant.gstNumber,
          gstPercent: Number(tenant.gstPercent),
          splitKitchen: tenant.splitKitchen,
          theme: (tenant.theme as Record<string, string>) ?? {},
          logoUrl: tenant.logoUrl,
        }}
        versions={versions.map((v) => ({
          id: v.id,
          savedAt: v.savedAt.toISOString(),
          savedBy: v.savedBy?.fullName ?? v.savedBy?.email ?? null,
          theme: (v.theme as Record<string, string>) ?? {},
        }))}
      />
    </>
  );
}
