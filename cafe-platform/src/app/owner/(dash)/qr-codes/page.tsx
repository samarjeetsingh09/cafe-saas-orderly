import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getOwnerCafe } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * My QR Codes (M6, FR-28): view/download each table's QR. Images are
 * rendered on the fly as data URLs — the M9 pipeline will persist real
 * print-ready assets to storage; the encoded URL is identical.
 */
export default async function OwnerQrCodesPage() {
  const cafe = (await getOwnerCafe())!;
  const tables = await prisma.table.findMany({
    where: { cafeId: cafe.id },
    orderBy: { tableNumber: "asc" },
    select: { id: true, tableNumber: true, qrToken: true },
  });

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const cards = await Promise.all(
    tables.map(async (t) => {
      const url = `${origin}/${cafe.slug}/t/${t.qrToken}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      return { ...t, url, dataUrl };
    }),
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">My QR Codes</h1>
      <p className="mt-1 text-sm text-slate-500">
        One QR per table. Download and print — customers scan to see the menu and order.
      </p>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-base font-medium text-slate-700">No tables set up yet</p>
          <p className="mt-1 text-sm text-slate-500">Ask support to add your tables and QR codes.</p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((t) => (
            <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-900">Table {t.tableNumber}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, next/image adds nothing */}
              <img
                src={t.dataUrl}
                alt={`QR code for table ${t.tableNumber}`}
                className="mx-auto mt-3 h-40 w-40 rounded-lg border border-slate-100"
              />
              <p className="mt-2 truncate text-xs text-slate-400" title={t.url}>
                {t.url}
              </p>
              <a
                href={t.dataUrl}
                download={`table-${t.tableNumber}-qr.png`}
                className="mt-3 inline-block w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
              >
                Download QR
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
