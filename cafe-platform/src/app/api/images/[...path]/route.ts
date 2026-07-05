import { readStoredImage } from "@/lib/storage";

/** Serves locally stored uploads (menu photos). Filenames are random hex → immutable cache. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const img = await readStoredImage(segments);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.body), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
