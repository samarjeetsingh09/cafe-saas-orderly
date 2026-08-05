import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/bus";
import { allowInWindow } from "@/lib/rate-limit";
import { boardOrderInclude, toBoardOrderDTO, type BoardOrderDTO } from "@/lib/owner-board";

/**
 * Order creation — plan/BUILD-SPEC.md §9 `POST /api/orders`. Two request
 * shapes, one pipeline: QR (anonymous, token-resolved table, Phase F) and
 * staff (`channel: 'staff'`, session-authenticated `tableId` + `placedBy`,
 * Phase H's "Take an order" POS). Prices/availability are always re-read
 * from the DB here; the client only ever supplies `variantId` + `qty`.
 */
const MAX_ORDERS_PER_TABLE_PER_MINUTE = 5;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

const ItemsSchema = z
  .array(
    z.object({
      variantId: z.string().uuid(),
      qty: z.number().int().min(1).max(50),
      note: z.string().max(200).nullish(),
    })
  )
  .min(1)
  .max(50);

const QrOrderInput = z.object({
  channel: z.literal("qr"),
  qrToken: z.string().min(1),
  items: ItemsSchema,
  payMethod: z.enum(["cash", "online"]),
  note: z.string().max(500).nullish(),
  customerName: z.string().trim().min(1).max(60).nullish(),
  customerPhone: z.string().regex(INDIAN_MOBILE).nullish(),
  idempotencyKey: z.string().min(8).max(80).nullish(),
});

const StaffOrderInput = z.object({
  channel: z.literal("staff"),
  tableId: z.string().uuid(),
  items: ItemsSchema,
  payMethod: z.enum(["cash", "online"]),
  note: z.string().max(500).nullish(),
  idempotencyKey: z.string().min(8).max(80).nullish(),
});

export const CreateOrderInput = z.discriminatedUnion("channel", [QrOrderInput, StaffOrderInput]);
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export type CreateOrderResult =
  | { ok: true; order: BoardOrderDTO }
  | { ok: false; status: number; error: string; unavailableNames?: string[] };

/** `staffCtx` is required (and trusted) when `input.channel === 'staff'` — the route owns auth. */
export async function createOrder(input: CreateOrderInput, staffCtx?: { tenantId: string; profileId: string }): Promise<CreateOrderResult> {
  const table =
    input.channel === "qr"
      ? await prisma.cafeTable.findUnique({
          where: { qrToken: input.qrToken },
          select: { id: true, label: true, active: true, tenant: { select: { id: true, slug: true, gstPercent: true, status: true } } },
        })
      : await prisma.cafeTable.findFirst({
          where: { id: input.tableId, tenantId: staffCtx!.tenantId },
          select: { id: true, label: true, active: true, tenant: { select: { id: true, slug: true, gstPercent: true, status: true } } },
        });

  if (!table) {
    return input.channel === "qr"
      ? { ok: false, status: 404, error: "This QR code didn't work. Please scan again." }
      : { ok: false, status: 404, error: "Table not found." };
  }
  if (!table.active || table.tenant.status === "paused" || table.tenant.status === "cancelled") {
    return { ok: false, status: 403, error: "This menu is temporarily unavailable. Please ask the staff for assistance." };
  }

  if (!allowInWindow(`orders:${table.id}`, MAX_ORDERS_PER_TABLE_PER_MINUTE, 60_000)) {
    return { ok: false, status: 429, error: "Too many orders from this table right now. Please wait a moment." };
  }

  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: table.tenant.id, idempotencyKey: input.idempotencyKey } },
      include: boardOrderInclude,
    });
    if (existing) return { ok: true, order: toBoardOrderDTO(existing) };
  }

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await prisma.itemVariant.findMany({
    where: { id: { in: variantIds }, tenantId: table.tenant.id },
    include: { item: { select: { id: true, name: true, isVeg: true, available: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  if (variants.length !== new Set(variantIds).size) {
    return { ok: false, status: 400, error: "Some items are no longer on the menu. Please review your cart." };
  }

  const unavailableNames = [...new Set(variants.filter((v) => !v.item.available).map((v) => v.item.name))];
  if (unavailableNames.length > 0) {
    return {
      ok: false,
      status: 409,
      error: `Just sold out: ${unavailableNames.join(", ")}. Please remove and try again.`,
      unavailableNames,
    };
  }

  const lines = input.items.map((i) => ({ variant: byId.get(i.variantId)!, qty: i.qty, note: i.note ?? null }));
  const subtotalPaise = lines.reduce((s, l) => s + l.variant.pricePaise * l.qty, 0);
  const taxPaise = Math.round((subtotalPaise * Number(table.tenant.gstPercent)) / 100);
  const totalPaise = subtotalPaise + taxPaise;
  const isVegSet = new Set(lines.map((l) => l.variant.item.isVeg));
  const station = isVegSet.size > 1 ? "mixed" : isVegSet.has(true) ? "veg" : "nonveg";
  const codePrefix = table.tenant.slug.charAt(0).toUpperCase();

  try {
    const order = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ code: string }[]>`SELECT next_order_code(${table.tenant.id}::uuid, ${codePrefix}) as code`;
      return tx.order.create({
        data: {
          tenantId: table.tenant.id,
          code: rows[0].code,
          tableId: table.id,
          tableLabel: table.label,
          station,
          channel: input.channel,
          placedBy: input.channel === "staff" ? staffCtx!.profileId : null,
          customerName: input.channel === "qr" ? (input.customerName ?? null) : null,
          customerPhone: input.channel === "qr" ? (input.customerPhone ?? null) : null,
          note: input.note ?? null,
          payMethod: input.payMethod,
          payStatus: "pending",
          subtotalPaise,
          taxPaise,
          totalPaise,
          idempotencyKey: input.idempotencyKey ?? null,
          items: {
            create: lines.map((l) => ({
              tenantId: table.tenant.id,
              itemId: l.variant.item.id,
              name: l.variant.item.name,
              variantLabel: l.variant.label,
              unitPaise: l.variant.pricePaise,
              qty: l.qty,
              isVeg: l.variant.item.isVeg,
              note: l.note,
            })),
          },
          events: {
            create: {
              tenantId: table.tenant.id,
              fromStage: null,
              toStage: "new",
              actorKind: input.channel === "staff" ? "staff" : "customer",
              actorId: input.channel === "staff" ? staffCtx!.profileId : null,
            },
          },
        },
        include: boardOrderInclude,
      });
    });

    const dto = toBoardOrderDTO(order);
    emit(table.tenant.id, "order.created", dto);
    return { ok: true, order: dto };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && input.idempotencyKey) {
      const existing = await prisma.order.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: table.tenant.id, idempotencyKey: input.idempotencyKey } },
        include: boardOrderInclude,
      });
      if (existing) return { ok: true, order: toBoardOrderDTO(existing) };
    }
    throw e;
  }
}
