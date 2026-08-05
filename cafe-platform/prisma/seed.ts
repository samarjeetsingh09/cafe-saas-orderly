/**
 * Bëlla demo seed — Tenant-based schema (plan/CLAUDE-CODE-BRIEF.md Step 2).
 * Menu/category/ticket content copied verbatim from plan/bella-admin-console.html's
 * CATS/CATALOG/TICKETS arrays (see NOTES.md decision #10). Prices there are rupees;
 * stored here as paise.
 * Run: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { seedDemoCafe } from "./demo-cafe";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

function randomHex(length = 32): string {
  return randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
}

/** Build a Date from an IST wall-clock date + time (explicit +05:30 offset). */
function ist(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}+05:30`);
}

/** Calendar date `daysAgo` days before today in IST, as YYYY-MM-DD (negative = future). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function dayString(daysAgo: number): string {
  return new Date(Date.now() + IST_OFFSET_MS - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

const rupeesToPaise = (r: number) => Math.round(r * 100);

// ───────────────────────── theme (CLAUDE-CODE-BRIEF Step 2, camelCase, no `danger` key) ─────────────────────────

const THEME = {
  bg: "#1d2520",
  surface: "#28322a",
  surface2: "#303b32",
  ink: "#f3e7d3",
  inkDim: "rgba(243,231,211,.60)",
  inkFaint: "rgba(243,231,211,.34)",
  line: "rgba(243,231,211,.13)",
  accent: "#e3b878",
  accent2: "#c9995a",
  veg: "#7fb069",
  nonveg: "#c96a55",
  warn: "#d8a24a",
  radius: "14px",
  fontDisplay: "Sacramento",
  fontBody: "Poppins",
};

// ───────────────────────── categories + menu (verbatim from bella-admin-console.html) ─────────────────────────

const CATS: { n: string; veg: boolean }[] = [
  { n: "Bella Greens", veg: true },
  { n: "Garden Plates", veg: true },
  { n: "Wood-Fired Veg", veg: true },
  { n: "Veg Mains", veg: true },
  { n: "Desserts", veg: true },
  { n: "Sips", veg: true },
  { n: "Greens with Protein", veg: false },
  { n: "Tandoor & Grills", veg: false },
  { n: "Wood-Fired Non-Veg", veg: false },
  { n: "Non-Veg Mains", veg: false },
  { n: "Desserts with Egg", veg: false },
];

type RawItem = { n: string; c: string; v: [string, number][]; d: string };

const CATALOG: RawItem[] = [
  // ---- veg kitchen ----
  { n: "Greek Salad", c: "Bella Greens", v: [["Regular", 375], ["Large", 425]], d: "Crunchy iceberg lettuce with cucumber, tomato, green pepper, red onion, olives & feta" },
  { n: "Chickpea Salad", c: "Bella Greens", v: [["Regular", 375]], d: "Homemade-style chef's special salad" },
  { n: "Bella Caesar Salad", c: "Bella Greens", v: [["Regular", 395], ["Large", 445]], d: "Green lettuce with lemon juice, garlic and parmesan cheese" },
  { n: "Somtam Salad", c: "Bella Greens", v: [["Regular", 395]], d: "Classic Thai papaya salad with lime, chilli and peanuts" },
  { n: "Quinoa & Avocado Salad", c: "Bella Greens", v: [["Regular", 445]], d: "Cucumber, onion, mixed bell pepper, cilantro, jalapeño & lemon juice" },
  { n: "Truffle Mushroom Bruschetta", c: "Garden Plates", v: [["4 pc", 425], ["8 pc", 745]], d: "Sourdough, garlic butter mushrooms, truffle oil, parmesan" },
  { n: "Peri Peri Paneer Skewers", c: "Garden Plates", v: [["Regular", 395]], d: "Charred paneer and bell pepper, house peri peri rub, mint dip" },
  { n: "Loaded Nachos", c: "Garden Plates", v: [["Regular", 375], ["Sharing", 625]], d: "Corn tortilla, cheddar sauce, salsa, jalapeño, sour cream" },
  { n: "Margherita", c: "Wood-Fired Veg", v: [['9"', 445], ['12"', 595]], d: "San Marzano tomato, fior di latte, fresh basil" },
  { n: "Garden Pesto", c: "Wood-Fired Veg", v: [['9"', 495], ['12"', 645]], d: "Basil pesto, zucchini, cherry tomato, olives, feta" },
  { n: "Penne Alfredo", c: "Veg Mains", v: [["Regular", 475]], d: "Slow-cooked cream sauce, parmesan, cracked pepper" },
  { n: "Thai Green Curry", c: "Veg Mains", v: [["Regular", 495]], d: "Coconut curry with seasonal vegetables, served with jasmine rice" },
  { n: "Molten Chocolate Cake", c: "Desserts", v: [["Regular", 345]], d: "Warm dark chocolate centre, vanilla bean ice cream" },
  { n: "Coconut Panna Cotta", c: "Desserts", v: [["Regular", 325]], d: "Set coconut cream, mango compote, toasted coconut · eggless" },
  { n: "Hibiscus Iced Tea", c: "Sips", v: [["Glass", 225], ["Pitcher", 595]], d: "Hibiscus, orange peel and honey, served over ice" },
  { n: "Cold Brew", c: "Sips", v: [["Regular", 275]], d: "18-hour steeped single origin, over ice" },
  { n: "Passionfruit Mojito", c: "Sips", v: [["Glass", 295], ["Pitcher", 695]], d: "Passionfruit, mint, lime and soda — non-alcoholic" },
  // ---- non-veg kitchen ----
  { n: "Grilled Chicken Caesar", c: "Greens with Protein", v: [["Regular", 495], ["Large", 545]], d: "Bella Caesar topped with herb-grilled chicken breast" },
  { n: "Smoked Salmon & Quinoa", c: "Greens with Protein", v: [["Regular", 625]], d: "Smoked salmon, quinoa, avocado, dill yoghurt dressing" },
  { n: "Chicken Malai Tikka", c: "Tandoor & Grills", v: [["6 pc", 475], ["12 pc", 875]], d: "Cream cheese and cardamom marinade, charred in the tandoor" },
  { n: "Chilli Garlic Prawns", c: "Tandoor & Grills", v: [["Regular", 545]], d: "Tossed in butter, garlic and dry red chilli, lemon on the side" },
  { n: "Loaded Nachos with Chicken", c: "Tandoor & Grills", v: [["Regular", 445], ["Sharing", 745]], d: "Corn tortilla, cheddar sauce, pulled chicken, jalapeño, sour cream" },
  { n: "Smoked Chicken & Jalapeño", c: "Wood-Fired Non-Veg", v: [['9"', 545], ['12"', 695]], d: "Smoked chicken, jalapeño, red onion, mozzarella" },
  { n: "Pepperoni", c: "Wood-Fired Non-Veg", v: [['9"', 575], ['12"', 725]], d: "Chicken pepperoni, mozzarella, oregano, chilli honey on the side" },
  { n: "Butter Chicken & Laccha Paratha", c: "Non-Veg Mains", v: [["Half", 545], ["Full", 895]], d: "Tandoori chicken in tomato-butter gravy, two parathas" },
  { n: "Grilled Fish & Lemon Butter", c: "Non-Veg Mains", v: [["Regular", 595]], d: "Basa fillet, lemon butter sauce, sautéed greens" },
  { n: "Chicken Penne Alfredo", c: "Non-Veg Mains", v: [["Regular", 525]], d: "Cream sauce, parmesan, herb-grilled chicken" },
  { n: "Tiramisu Jar", c: "Desserts with Egg", v: [["Single", 325], ["Sharing jar", 595]], d: "Espresso-soaked savoiardi, mascarpone, cocoa · contains egg" },
];

const GST_PERCENT = 5;

async function main() {
  // ── Tenant ──────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "bella" },
    update: {},
    create: {
      slug: "bella",
      name: "Bëlla",
      tagline: "Botanical Dining Experience",
      theme: THEME,
      currency: "INR",
      gstPercent: GST_PERCENT,
      timezone: "Asia/Kolkata",
      splitKitchen: true,
      status: "active",
    },
  });

  // ── Categories ──────────────────────────────────────────────────────
  const catByName = new Map<string, { id: string; isVeg: boolean }>();
  for (let i = 0; i < CATS.length; i++) {
    const c = CATS[i];
    const row = await prisma.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: c.n } },
      update: {},
      create: { tenantId: tenant.id, name: c.n, isVeg: c.veg, sortOrder: i },
    });
    catByName.set(c.n, { id: row.id, isVeg: row.isVeg });
  }

  // ── Menu items + variants ──────────────────────────────────────────
  type ItemRow = { id: string; isVeg: boolean; variants: { id: string; label: string; pricePaise: number }[] };
  const itemByName = new Map<string, ItemRow>();
  for (let i = 0; i < CATALOG.length; i++) {
    const d = CATALOG[i];
    const cat = catByName.get(d.c)!;
    const item = await prisma.menuItem.create({
      data: { tenantId: tenant.id, categoryId: cat.id, name: d.n, description: d.d, isVeg: cat.isVeg, sortOrder: i },
    });
    const variants = [];
    for (let j = 0; j < d.v.length; j++) {
      const [label, priceRupees] = d.v[j];
      const variant = await prisma.itemVariant.create({
        data: { tenantId: tenant.id, itemId: item.id, label, pricePaise: rupeesToPaise(priceRupees), sortOrder: j },
      });
      variants.push({ id: variant.id, label: variant.label, pricePaise: variant.pricePaise });
    }
    itemByName.set(d.n, { id: item.id, isVeg: cat.isVeg, variants });
  }
  const vegItems = [...itemByName.values()].filter((i) => i.isVeg);
  const nonvegItems = [...itemByName.values()].filter((i) => !i.isVeg);
  const itemNameById = new Map<string, string>();
  for (const [name, row] of itemByName) itemNameById.set(row.id, name);

  // ── Tables — 16, last two disabled ─────────────────────────────────
  const tables = [];
  for (let n = 1; n <= 16; n++) {
    const label = String(n).padStart(2, "0");
    const t = await prisma.cafeTable.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label } },
      update: {},
      create: { tenantId: tenant.id, label, qrToken: randomHex(32), active: n <= 14 },
    });
    tables.push(t);
  }
  const activeTables = tables.filter((t) => t.active);

  // ── Staff ───────────────────────────────────────────────────────────
  const staffPasswordHash = await bcrypt.hash("demo1234", 10);
  const owner = await prisma.profile.upsert({
    where: { email: "owner@bella.test" },
    update: {},
    create: { tenantId: tenant.id, fullName: "Rohan Mehta", email: "owner@bella.test", passwordHash: staffPasswordHash, role: "owner" },
  });
  const waiter = await prisma.profile.upsert({
    where: { email: "waiter@bella.test" },
    update: {},
    create: { tenantId: tenant.id, fullName: "Ravi Kumar", email: "waiter@bella.test", passwordHash: staffPasswordHash, role: "waiter" },
  });
  await prisma.profile.upsert({
    where: { email: "veg@bella.test" },
    update: {},
    create: { tenantId: tenant.id, fullName: "Asha Nair", email: "veg@bella.test", passwordHash: staffPasswordHash, role: "kitchen", station: "veg" },
  });
  await prisma.profile.upsert({
    where: { email: "tandoor@bella.test" },
    update: {},
    create: { tenantId: tenant.id, fullName: "Imran Sheikh", email: "tandoor@bella.test", passwordHash: staffPasswordHash, role: "kitchen", station: "nonveg" },
  });

  // ── Order helpers ───────────────────────────────────────────────────
  const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  async function nextCode(): Promise<string> {
    const rows = await prisma.$queryRaw<{ code: string }[]>`SELECT next_order_code(${tenant.id}::uuid, 'B') as code`;
    return rows[0].code;
  }

  type Line = { item: ItemRow; variant: { id: string; label: string; pricePaise: number }; qty: number };

  function pickLines(veg: boolean): Line[] {
    const pool = veg ? vegItems : nonvegItems;
    const n = 1 + Math.floor(Math.random() * 2);
    const chosen: Line[] = [];
    for (let i = 0; i < n; i++) {
      const item = rand(pool);
      if (chosen.some((l) => l.item.id === item.id)) continue;
      chosen.push({ item, variant: rand(item.variants), qty: 1 + Math.floor(Math.random() * 2) });
    }
    if (!chosen.length) chosen.push({ item: pool[0], variant: pool[0].variants[0], qty: 1 });
    return chosen;
  }

  async function makeOrder(opts: {
    stage: "new" | "preparing" | "ready" | "served" | "cancelled";
    placedAt: Date;
    veg: boolean;
    payMethod: "cash" | "online";
    payStatus: "pending" | "paid" | "failed" | "refunded";
    note?: string;
    channel?: "qr" | "staff";
    placedBy?: string;
  }) {
    const lines = pickLines(opts.veg);
    const subtotalPaise = lines.reduce((s, l) => s + l.variant.pricePaise * l.qty, 0);
    const taxPaise = Math.round((subtotalPaise * GST_PERCENT) / 100);
    const totalPaise = subtotalPaise + taxPaise;
    const isVegSet = new Set(lines.map((l) => l.item.isVeg));
    const station = isVegSet.size > 1 ? "mixed" : isVegSet.has(true) ? "veg" : "nonveg";
    const table = rand(activeTables);
    const code = await nextCode();

    const stageOrder = ["new", "preparing", "ready", "served"];
    const idx = stageOrder.indexOf(opts.stage);
    const acceptedAt = idx >= 1 ? new Date(opts.placedAt.getTime() + 2 * 60_000) : null;
    const readyAt = idx >= 2 ? new Date(opts.placedAt.getTime() + 10 * 60_000) : null;
    const servedAt = idx >= 3 ? new Date(opts.placedAt.getTime() + 15 * 60_000) : null;

    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        code,
        tableId: table.id,
        tableLabel: table.label,
        station,
        channel: opts.channel ?? "qr",
        placedBy: opts.placedBy,
        note: opts.note,
        stage: opts.stage,
        payMethod: opts.payMethod,
        payStatus: opts.payStatus,
        subtotalPaise,
        taxPaise,
        totalPaise,
        placedAt: opts.placedAt,
        acceptedAt,
        readyAt,
        servedAt,
        items: {
          create: lines.map((l) => ({
            tenantId: tenant.id,
            itemId: l.item.id,
            name: itemNameById.get(l.item.id)!,
            variantLabel: l.variant.label,
            unitPaise: l.variant.pricePaise,
            qty: l.qty,
            isVeg: l.item.isVeg,
          })),
        },
        events: {
          create: {
            tenantId: tenant.id,
            fromStage: null,
            toStage: "new",
            actorKind: opts.channel === "staff" ? "staff" : "customer",
            at: opts.placedAt,
          },
        },
      },
    });
    return order;
  }

  // ── 7 live orders (today, ages 1-40 min, mixed stages/pay, 2 with notes) ──
  const now = Date.now();
  const liveOrders: Array<Parameters<typeof makeOrder>[0]> = [
    { stage: "served", placedAt: new Date(now - 40 * 60_000), veg: true, payMethod: "cash", payStatus: "paid" },
    { stage: "served", placedAt: new Date(now - 33 * 60_000), veg: false, payMethod: "online", payStatus: "paid" },
    { stage: "ready", placedAt: new Date(now - 16 * 60_000), veg: true, payMethod: "online", payStatus: "paid" },
    { stage: "preparing", placedAt: new Date(now - 19 * 60_000), veg: false, payMethod: "cash", payStatus: "pending", note: "Less spicy please" },
    { stage: "preparing", placedAt: new Date(now - 8 * 60_000), veg: true, payMethod: "online", payStatus: "paid" },
    { stage: "new", placedAt: new Date(now - 3 * 60_000), veg: false, payMethod: "cash", payStatus: "pending", note: "No onion" },
    { stage: "new", placedAt: new Date(now - 1 * 60_000), veg: true, payMethod: "online", payStatus: "pending" },
  ];
  for (const o of liveOrders) await makeOrder(o);

  // one staff-punched order so the console's "by Ravi" pill has something to show
  await makeOrder({
    stage: "preparing",
    placedAt: new Date(now - 6 * 60_000),
    veg: true,
    payMethod: "cash",
    payStatus: "pending",
    channel: "staff",
    placedBy: waiter.id,
  });

  // ── 30 days of backdated served orders (Reports history) ──────────
  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const day = dayString(daysAgo);
    const dow = new Date(ist(day, "12:00:00")).getUTCDay(); // 0=Sun..6=Sat (IST wall-clock date, UTC getters fine here)
    const isWeekend = dow === 0 || dow === 6;
    const ordersToday = isWeekend ? 6 + Math.floor(Math.random() * 4) : 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < ordersToday; i++) {
      const hour = String(9 + Math.floor(Math.random() * 11)).padStart(2, "0");
      const min = String(Math.floor(Math.random() * 60)).padStart(2, "0");
      await makeOrder({
        stage: "served",
        placedAt: ist(day, `${hour}:${min}:00`),
        veg: Math.random() < 0.55,
        payMethod: Math.random() < 0.6 ? "online" : "cash",
        payStatus: "paid",
      });
    }
  }

  // ── Support tickets (verbatim from bella-admin-console.html TICKETS) ──
  const AGO = (min: number) => new Date(now - min * 60_000);

  async function ensureTicket(data: Parameters<typeof prisma.ticket.create>[0]["data"] & { code: string }) {
    const exists = await prisma.ticket.findFirst({ where: { tenantId: tenant.id, code: data.code } });
    if (!exists) await prisma.ticket.create({ data });
  }

  await ensureTicket({
    tenantId: tenant.id,
    code: "Q-2041",
    topic: "QR code / tables",
    subject: "Table 12 ka QR sticker phat gaya hai",
    priority: "normal",
    state: "with_us",
    openedBy: owner.id,
    createdAt: AGO(190),
    messages: {
      create: [
        { tenantId: tenant.id, authorKind: "cafe", authorId: owner.id, body: "Table 12 ka code kharab ho gaya, customers scan nahi kar pa rahe. Naya print bhej sakte ho?", at: AGO(190) },
        { tenantId: tenant.id, authorKind: "support", body: "Noted. Table 12 ke liye naya code assign kar diya hai — laminated print kal shaam tak pahunch jayega. Tab tak table 12 ko disabled rakhein.", at: AGO(155) },
      ],
    },
  });

  await ensureTicket({
    tenantId: tenant.id,
    code: "Q-2038",
    topic: "Payments & settlement",
    subject: "Kal ka online settlement abhi tak credit nahi hua",
    priority: "high",
    state: "open",
    openedBy: owner.id,
    createdAt: AGO(320),
    messages: {
      create: [
        { tenantId: tenant.id, authorKind: "cafe", authorId: owner.id, body: "31 tarikh ka ₹18,400 online collection bank me nahi aaya. Statement check kar liya hai.", at: AGO(320) },
      ],
    },
  });

  await ensureTicket({
    tenantId: tenant.id,
    code: "Q-2027",
    topic: "Menu & pricing",
    subject: "Weekend pe pizza ka alag price rakh sakte hain?",
    priority: "normal",
    state: "resolved",
    openedBy: owner.id,
    createdAt: AGO(2880),
    messages: {
      create: [
        { tenantId: tenant.id, authorKind: "cafe", authorId: owner.id, body: "Sat-Sun pe wood-fired pizza ka rate thoda alag rakhna chahte hain. Possible hai?", at: AGO(2880) },
        { tenantId: tenant.id, authorKind: "support", body: "Haan — abhi ke liye aap size variants use kar sakte hain. Scheduled weekend pricing agle update me aa raha hai.", at: AGO(2760) },
        { tenantId: tenant.id, authorKind: "cafe", authorId: owner.id, body: "Theek hai, thanks!", at: AGO(2700) },
      ],
    },
  });

  // ── Plans + subscription + invoices ────────────────────────────────
  const plans = [
    { id: "starter", name: "Starter", pricePaise: rupeesToPaise(1499), maxTables: 8, features: ["core_ordering"], sortOrder: 1 },
    { id: "growth", name: "Growth", pricePaise: rupeesToPaise(2999), maxTables: 16, features: ["core_ordering", "split_kitchen", "analytics"], sortOrder: 2 },
    { id: "pro", name: "Pro", pricePaise: rupeesToPaise(5499), maxTables: 30, features: ["core_ordering", "split_kitchen", "analytics", "whatsapp_bill"], sortOrder: 3 },
    { id: "enterprise", name: "Enterprise", pricePaise: 0, maxTables: 999, features: ["core_ordering", "split_kitchen", "analytics", "whatsapp_bill", "custom_pricing"], sortOrder: 4 },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: "growth",
      status: "active",
      currentStart: ist(dayString(20), "00:00:00"),
      currentEnd: ist(dayString(-10), "00:00:00"),
    },
  });

  const invoiceExisting = await prisma.invoice.count({ where: { tenantId: tenant.id } });
  if (invoiceExisting === 0) {
    for (let i = 5; i >= 1; i--) {
      await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          number: `INV-${1000 + i}`,
          amountPaise: rupeesToPaise(2999),
          status: "paid",
          issuedOn: ist(dayString(20 + i * 30), "00:00:00"),
        },
      });
    }
  }

  // ── HQ: one PlatformUser ───────────────────────────────────────────
  await prisma.platformUser.upsert({
    where: { email: "hq@orderly.test" },
    update: {},
    create: {
      email: "hq@orderly.test",
      passwordHash: await bcrypt.hash("demo1234", 10),
      fullName: "OrderLy HQ",
      role: "super_admin",
    },
  });

  // ── Second tenant: Demo Cafe (marketing-site palette) ──────────────
  // Runs after plans exist, so its subscription can be attached. Bëlla above
  // is untouched by it — see prisma/demo-cafe.ts.
  const demo = await seedDemoCafe(prisma);

  // ── Summary ──────────────────────────────────────────────────────────
  const counts = {
    tenants: await prisma.tenant.count(),
    profiles: await prisma.profile.count(),
    cafe_tables: await prisma.cafeTable.count(),
    categories: await prisma.category.count(),
    menu_items: await prisma.menuItem.count(),
    item_variants: await prisma.itemVariant.count(),
    orders: await prisma.order.count(),
    order_items: await prisma.orderItem.count(),
    order_events: await prisma.orderEvent.count(),
    tickets: await prisma.ticket.count(),
    ticket_messages: await prisma.ticketMessage.count(),
    plans: await prisma.plan.count(),
    subscriptions: await prisma.subscription.count(),
    invoices: await prisma.invoice.count(),
    platform_users: await prisma.platformUser.count(),
  };

  console.log("\nRow counts:");
  console.table(counts);

  console.log("\nLogin table:");
  console.table([
    { role: "owner", email: "owner@bella.test", password: "demo1234" },
    { role: "waiter", email: "waiter@bella.test", password: "demo1234" },
    { role: "kitchen (veg)", email: "veg@bella.test", password: "demo1234" },
    { role: "kitchen (nonveg)", email: "tandoor@bella.test", password: "demo1234" },
    { role: "HQ super_admin", email: "hq@orderly.test", password: "demo1234" },
    { role: "owner (Demo Cafe)", email: "owner@democafe.test", password: "demo1234" },
    { role: "kitchen veg (Demo Cafe)", email: "veg@democafe.test", password: "demo1234" },
    { role: "kitchen nonveg (Demo Cafe)", email: "grill@democafe.test", password: "demo1234" },
  ]);

  if (demo.firstTable) console.log(`\nDemo Cafe table ${demo.firstTable.label} menu:  /t/${demo.firstTable.qrToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
