import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import type { Prisma, PlatformUser, ProfileRole } from "@prisma/client";

/**
 * `provisionCafe()` — HQ-PORTAL-SPEC.md §6 provisioning engine. One Prisma
 * transaction: tenant, payment config, subscription, tables + QR tokens,
 * staff users, tenant health row, activity log — any failure rolls
 * everything back (Checkpoint I / Phase J item 12).
 *
 * File uploads (logo/font) already happened before this is called — the
 * wizard's upload endpoint returns a URL, this function only ever stores
 * strings, never holds the transaction open across network/disk I/O.
 */

export type ProvisionInput = {
  idempotencyKey: string;
  cafe: {
    name: string;
    slug: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    address?: string;
    timezone: string;
    gstNumber?: string;
    gstPercent: number;
  };
  branding: {
    logoUrl?: string;
    faviconUrl?: string;
    theme: Record<string, string>;
  };
  subscription: {
    planId: string;
    startDate: string;
    endDate: string;
    setupFeePaise?: number;
    trial: boolean;
    trialEndsAt?: string;
  };
  payments: {
    acceptCash: boolean;
    acceptCounterUpi: boolean;
    acceptOnline: boolean;
    gateway?: string;
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
    enabled: boolean;
  };
  tables: {
    count: number;
    startingNumber: number;
  };
  splitKitchen: boolean;
  templateId?: string;
};

export type ProvisionedCredential = { role: string; fullName: string; email: string; password: string };

export type ProvisionResult = {
  tenantId: string;
  slug: string;
  tenantName: string;
  tableCount: number;
  tables: { label: string; qrToken: string }[];
  credentials: ProvisionedCredential[];
};

/** Strong, human-typeable password: 3 random words + 2 digits, e.g. "cedar-lumen-42-quartz". */
const WORDS = [
  "cedar", "lumen", "quartz", "amber", "ridge", "cobalt", "willow", "ember",
  "harbor", "meadow", "granite", "onyx", "sable", "birch", "coral", "ivory",
  "maple", "opal", "raven", "slate", "tundra", "violet", "walnut", "zephyr",
];
export function generatePassword(): string {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  const digits = String(randomBytes(1)[0] % 100).padStart(2, "0");
  return `${pick()}-${pick()}-${digits}-${pick()}`;
}

/** In-memory idempotency cache — one Node process, matches lib/rate-limit.ts's pattern. */
const idempotencyCache = new Map<string, { at: number; result: ProvisionResult }>();
const IDEMPOTENCY_TTL_MS = 5 * 60_000;

export async function provisionCafe(input: ProvisionInput, actor: PlatformUser): Promise<ProvisionResult> {
  const cached = idempotencyCache.get(input.idempotencyKey);
  if (cached && Date.now() - cached.at < IDEMPOTENCY_TTL_MS) return cached.result;

  const template = input.templateId
    ? await prisma.cafeTemplate.findUnique({ where: { id: input.templateId } })
    : null;

  const result = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: input.cafe.slug,
          name: input.cafe.name,
          logoUrl: input.branding.logoUrl,
          faviconUrl: input.branding.faviconUrl,
          theme: input.branding.theme,
          gstPercent: input.cafe.gstPercent,
          gstNumber: input.cafe.gstNumber,
          address: input.cafe.address,
          phone: input.cafe.ownerPhone,
          timezone: input.cafe.timezone,
          splitKitchen: input.splitKitchen,
          status: input.subscription.trial ? "trial" : "active",
          trialEndsAt: input.subscription.trial && input.subscription.trialEndsAt ? new Date(input.subscription.trialEndsAt) : null,
          setupFeePaise: input.subscription.setupFeePaise,
          templateId: input.templateId,
        },
      });

      await tx.paymentConfig.create({
        data: {
          tenantId: tenant.id,
          acceptCash: input.payments.acceptCash,
          acceptCounterUpi: input.payments.acceptCounterUpi,
          acceptOnline: input.payments.acceptOnline,
          gateway: input.payments.gateway,
          keyId: input.payments.keyId,
          keySecretEnc: input.payments.keySecret ? encryptSecret(input.payments.keySecret) : null,
          webhookSecretEnc: input.payments.webhookSecret ? encryptSecret(input.payments.webhookSecret) : null,
          enabled: input.payments.enabled,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: input.subscription.planId,
          status: input.subscription.trial ? "trialing" : "active",
          currentStart: new Date(input.subscription.startDate),
          currentEnd: new Date(input.subscription.endDate),
        },
      });

      const tables = [];
      for (let i = 0; i < input.tables.count; i++) {
        const label = String(input.tables.startingNumber + i).padStart(2, "0");
        tables.push(
          await tx.cafeTable.create({
            data: { tenantId: tenant.id, label, qrToken: randomBytes(16).toString("hex"), active: true },
          })
        );
      }

      const credentials: ProvisionedCredential[] = [];
      async function createUser(role: ProfileRole, fullName: string, email: string, station?: "veg" | "nonveg") {
        const password = generatePassword();
        await tx.profile.create({
          data: { tenantId: tenant.id, fullName, email, passwordHash: await hashPassword(password), role, station },
        });
        credentials.push({ role: station ? `${role} (${station})` : role, fullName, email, password });
      }

      await createUser("owner", input.cafe.ownerName, input.cafe.ownerEmail);
      await createUser("manager", `${input.cafe.ownerName} (reception)`, deriveEmail(input.cafe.slug, "reception"));
      if (input.splitKitchen) {
        await createUser("kitchen", "Kitchen — Veg", deriveEmail(input.cafe.slug, "veg"), "veg");
        await createUser("kitchen", "Kitchen — Non-veg", deriveEmail(input.cafe.slug, "nonveg"), "nonveg");
      } else {
        await createUser("kitchen", "Kitchen", deriveEmail(input.cafe.slug, "kitchen"));
      }

      if (template) {
        await cloneTemplateMenu(tx, tenant.id, template);
      }

      await tx.tenantHealth.create({ data: { tenantId: tenant.id } });

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          tenantId: tenant.id,
          action: "cafe.provisioned",
          target: `tenant:${tenant.id}`,
          summary: `${actor.fullName} provisioned ${tenant.name} with ${tables.length} tables`,
          meta: { plan: input.subscription.planId, tables: tables.length, templateId: input.templateId ?? null },
        },
      });

      return {
        tenantId: tenant.id,
        slug: tenant.slug,
        tenantName: tenant.name,
        tableCount: tables.length,
        tables: tables.map((t) => ({ label: t.label, qrToken: t.qrToken })),
        credentials,
      };
    },
    { timeout: 20_000 }
  );

  idempotencyCache.set(input.idempotencyKey, { at: Date.now(), result });
  return result;
}

function deriveEmail(slug: string, role: string): string {
  return `${role}@${slug}.orderly.test`;
}

/** Clone a template's categories/items/variants onto a freshly created tenant. */
async function cloneTemplateMenu(tx: Prisma.TransactionClient, tenantId: string, template: { categories: unknown }) {
  const categories = template.categories as Array<{
    name: string;
    isVeg: boolean;
    items: Array<{ name: string; description?: string; variants: Array<{ label: string; pricePaise: number }> }>;
  }>;
  for (let ci = 0; ci < categories.length; ci++) {
    const c = categories[ci];
    const category = await tx.category.create({ data: { tenantId, name: c.name, isVeg: c.isVeg, sortOrder: ci } });
    for (let ii = 0; ii < c.items.length; ii++) {
      const it = c.items[ii];
      const item = await tx.menuItem.create({
        data: { tenantId, categoryId: category.id, name: it.name, description: it.description, isVeg: c.isVeg, sortOrder: ii },
      });
      for (let vi = 0; vi < it.variants.length; vi++) {
        const v = it.variants[vi];
        await tx.itemVariant.create({ data: { tenantId, itemId: item.id, label: v.label, pricePaise: v.pricePaise, sortOrder: vi } });
      }
    }
  }
}
