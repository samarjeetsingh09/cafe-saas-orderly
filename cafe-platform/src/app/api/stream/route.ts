import { subscribe, type BusMessage } from "@/lib/bus";
import { requireProfile, UnauthorizedError } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * plan/CLAUDE-CODE-BRIEF.md Step 4 / plan/BUILD-SPEC.md's realtime section.
 * Tenant-scoped SSE subscribed to `t:${tenantId}` on lib/bus.ts. 25s
 * heartbeat comments keep proxies from closing an idle connection; the
 * client (hooks/useLiveOrders.ts) owns reconnect-with-backoff. Node runtime
 * because lib/bus.ts uses the `events` module.
 *
 * Three callers, one channel (plan/CLAUDE-CODE-BRIEF.md: "do not write a
 * second sync path"):
 *  - Staff (console/kitchen): full tenant stream, no filter.
 *  - Anonymous customer tracker (Phase F): `?orderId=&qrToken=` scopes the
 *    same tenant channel down to messages about that one order, so a
 *    customer's browser never sees another table's name/phone/notes.
 *  - Anonymous customer menu watcher (Phase G): `?qrToken=` alone (no
 *    `orderId`, e.g. still browsing, nothing placed yet) scopes down to
 *    `menu.updated` only — never order data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

type Scope = { tenantId: string; filter?: (msg: BusMessage) => boolean };

async function resolveScope(request: Request): Promise<Scope | null> {
  try {
    const tenantId = (await requireProfile()).tenantId;
    return { tenantId };
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId");
  const qrToken = url.searchParams.get("qrToken");
  if (!qrToken) return null;

  const table = await prisma.cafeTable.findUnique({ where: { qrToken }, select: { tenantId: true } });
  if (!table) return null;

  if (!orderId) {
    return { tenantId: table.tenantId, filter: (msg) => msg.event === "menu.updated" };
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: table.tenantId }, select: { id: true } });
  if (!order) return null;

  return {
    tenantId: table.tenantId,
    filter: (msg) => (msg.payload as { id?: string } | undefined)?.id === orderId,
  };
}

export async function GET(request: Request) {
  const scope = await resolveScope(request);
  if (!scope) {
    return new Response("Not authorized for this stream", { status: 401 });
  }
  const { tenantId, filter } = scope;

  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // stream already closed client-side; the abort listener below cleans up
        }
      };

      unsubscribe = subscribe(tenantId, (msg) => {
        if (filter && !filter(msg)) return;
        send(`data: ${JSON.stringify(msg)}\n\n`);
      });

      heartbeat = setInterval(() => send(`: heartbeat\n\n`), HEARTBEAT_MS);
      send(`: connected\n\n`);
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubscribe();
    clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
