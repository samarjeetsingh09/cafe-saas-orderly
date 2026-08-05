import { NextResponse } from "next/server";
import { requireHq } from "@/lib/hq-guard";
import { saveBrandingAsset, generateFavicon } from "@/lib/storage";

/**
 * Wizard Step 2 logo upload. Both the logo and its derived favicon are
 * written to disk here, well before the provisioning transaction opens
 * (HQ-PORTAL-SPEC.md §6 Step 4's "never hold a transaction open across
 * network/disk I/O" — this request happens on file-select, submit only
 * ever writes the two URLs it already has).
 */
export async function POST(request: Request) {
  const guard = await requireHq("provisionCafe");
  if ("error" in guard) return guard.error;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const logo = await saveBrandingAsset(buf);
  if ("error" in logo) return NextResponse.json(logo, { status: 400 });
  const favicon = await generateFavicon(buf);
  return NextResponse.json({ url: logo.url, faviconUrl: favicon.url });
}
