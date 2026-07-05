import { NextResponse } from "next/server";
import { requireOwner, UnauthorizedError } from "@/lib/session";
import { saveMenuPhoto } from "@/lib/storage";

/**
 * Menu photo upload (M6 leftover, Security doc 5.9). Multipart field
 * "file"; type sniffed from magic bytes, 2MB cap. Returns the URL the
 * dish form then saves as photoUrl. Storage path is scoped by cafe id.
 */
export async function POST(request: Request) {
  let cafeId: string;
  try {
    cafeId = (await requireOwner()).id;
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Owner session required" }, { status: 401 });
    }
    throw e;
  }

  let file: unknown;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pick a photo to upload." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await saveMenuPhoto(cafeId, buf);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, url: result.url }, { status: 201 });
}
