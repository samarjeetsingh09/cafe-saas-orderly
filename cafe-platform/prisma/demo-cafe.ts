/**
 * "Demo Cafe" — a second live tenant alongside Bëlla, themed to match the
 * OrderLy marketing site (globals.css: cream #fff8f1 paper, burnt-amber
 * accent, Fraunces display over Geist body) instead of Bëlla's dark botanical
 * palette. It exists so the customer app can be shown in the same skin the
 * landing page wears, and so a second palette keeps the theming honest —
 * anything that only looks right on a dark theme shows up here immediately.
 *
 * Bëlla is never touched by this file. Everything is upsert/guarded, so
 * running it twice is a no-op rather than a duplicate menu.
 */
import type { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const SLUG = "demo-cafe";
const GST_PERCENT = 5;

const rupeesToPaise = (r: number) => Math.round(r * 100);
const randomHex = (length = 32) =>
  randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);

/**
 * The marketing site's tokens (src/app/globals.css) mapped onto the frozen
 * customer/console token list (styles/tokens.css). Two deliberate departures
 * from the landing page's raw values:
 *   - accent is amber-700 (#b45309), not the site's amber-600 (#d97706) —
 *     the ordering app paints prices and category labels in --accent, and
 *     #d97706 on #fff8f1 lands at ~3.1:1, under the 4.5:1 text minimum.
 *   - the depth tokens are warm brown at low alpha rather than the default
 *     black, so sunken fields read as tinted paper and not as grey holes.
 */
const THEME = {
  bg: "#fff8f1",
  surface: "#ffffff",
  surface2: "#fdf0e2",
  ink: "#2b2b2b",
  inkDim: "rgba(43,43,43,.66)",
  inkFaint: "rgba(43,43,43,.44)",
  line: "rgba(124,63,0,.16)",
  accent: "#b45309",
  accent2: "#7c3f00",
  veg: "#16a34a",
  nonveg: "#dc2626",
  warn: "#f59e0b",
  danger: "#dc2626",
  shadeRgb: "124 63 0",
  sunken: "rgba(124,63,0,.07)",
  sunkenSoft: "rgba(124,63,0,.05)",
  shadow: "rgba(124,63,0,.16)",
  scrim: "rgba(43,30,18,.55)",
  radius: "14px",
  fontDisplay: "Fraunces",
  fontBody: "Geist",

  /*
   * Solid brown masthead, the same block the marketing hero's phone wears
   * (menu-phone.css `--mp-primary`). On a cream palette the default header —
   * a wash of the page background — disappears into the menu; a light cafe
   * needs the block to hold the top of the screen. See styles/tokens.css for
   * what each key drives.
   *
   * The accent is #f5c07a, not the hero's #f0b45f: the header paints 11px
   * uppercase switch labels in --accent, and #f0b45f on #7c3f00 lands at
   * 4.4:1, just under the 4.5:1 text minimum. Same departure, same reason, as
   * the page accent above.
   */
  headerBg: "#7c3f00",
  headerInk: "#fff8f1",
  headerInkDim: "rgba(255,248,241,.74)",
  headerInkFaint: "rgba(255,248,241,.52)",
  headerAccent: "#f5c07a",
  headerLine: "rgba(255,248,241,.22)",
  headerSunken: "rgba(43,20,0,.24)",
  headerSunkenSoft: "rgba(43,20,0,.18)",
};

const CATS: { n: string; veg: boolean }[] = [
  { n: "All-Day Breakfast", veg: true },
  { n: "Small Plates", veg: true },
  { n: "Toasts & Sandwiches", veg: true },
  { n: "Bowls & Mains", veg: true },
  { n: "Bakery", veg: true },
  { n: "Coffee & Cold", veg: true },
  { n: "Eggs & Benedicts", veg: false },
  { n: "Grills & Skewers", veg: false },
  { n: "Chicken Mains", veg: false },
];

type RawItem = { n: string; c: string; v: [string, number][]; d: string };

const CATALOG: RawItem[] = [
  // ---- veg kitchen ----
  { n: "Masala Scramble & Sourdough", c: "All-Day Breakfast", v: [["Regular", 285]], d: "Soft-set scrambled paneer, onion, tomato, green chilli, buttered sourdough" },
  { n: "Buttermilk Pancakes", c: "All-Day Breakfast", v: [["Short stack", 265], ["Tall stack", 345]], d: "Three-high, maple butter, seasonal fruit" },
  { n: "Poha & Filter Coffee", c: "All-Day Breakfast", v: [["Regular", 195]], d: "Kanda poha, roasted peanuts, lime, with a tumbler of filter coffee" },
  { n: "Overnight Oats", c: "All-Day Breakfast", v: [["Regular", 245]], d: "Rolled oats set in almond milk, banana, chia, honey drizzle" },
  { n: "Truffle Cheese Fries", c: "Small Plates", v: [["Regular", 265], ["Sharing", 425]], d: "Skin-on fries, truffle oil, aged cheddar sauce, chives" },
  { n: "Chilli Cheese Corn", c: "Small Plates", v: [["Regular", 235]], d: "Sweet corn baked with jalapeño, cream cheese and a herb crust" },
  { n: "Hummus & Warm Pita", c: "Small Plates", v: [["Regular", 295]], d: "Slow-blended chickpea hummus, olive oil, za'atar, two warm pitas" },
  { n: "Paneer Tikka Poppers", c: "Small Plates", v: [["8 pc", 315]], d: "Crumb-fried marinated paneer, mint mayo on the side" },
  { n: "Avocado Smash Toast", c: "Toasts & Sandwiches", v: [["Regular", 325]], d: "Multigrain, smashed avocado, chilli flakes, lemon, feta crumble" },
  { n: "Grilled Cheese & Tomato", c: "Toasts & Sandwiches", v: [["Regular", 275]], d: "Three cheeses, slow-roasted tomato, on butter-griddled sourdough" },
  { n: "Bombay Club Sandwich", c: "Toasts & Sandwiches", v: [["Regular", 295]], d: "Potato, beetroot, cucumber, chutney, triple-decker, house chips" },
  { n: "Mushroom & Thyme Toast", c: "Toasts & Sandwiches", v: [["Regular", 305]], d: "Butter-tossed mushrooms, thyme, cream, parmesan shavings" },
  { n: "Buddha Bowl", c: "Bowls & Mains", v: [["Regular", 395]], d: "Quinoa, roast pumpkin, chickpea, greens, tahini dressing" },
  { n: "Penne Arrabbiata", c: "Bowls & Mains", v: [["Regular", 365]], d: "Slow-cooked tomato, garlic, dry chilli, basil, parmesan" },
  { n: "Khichdi Bowl", c: "Bowls & Mains", v: [["Regular", 285]], d: "Moong dal khichdi, ghee, papad, kadhi on the side" },
  { n: "Margherita Pizza", c: "Bowls & Mains", v: [['9"', 385], ['12"', 525]], d: "Tomato, fior di latte, fresh basil, cold-pressed olive oil" },
  { n: "Basque Cheesecake", c: "Bakery", v: [["Slice", 265]], d: "Burnt-top, barely-set centre, no crust" },
  { n: "Almond Croissant", c: "Bakery", v: [["Each", 185]], d: "Two-day laminated, frangipane filled, toasted flakes" },
  { n: "Banana Walnut Loaf", c: "Bakery", v: [["Slice", 165]], d: "Overripe banana, dark muscovado, toasted walnut" },
  { n: "Dark Chocolate Cookie", c: "Bakery", v: [["Each", 145], ["Box of 4", 495]], d: "Sea-salt finished, molten centre when warm" },
  { n: "Filter Coffee", c: "Coffee & Cold", v: [["Tumbler", 125]], d: "South Indian filter decoction, frothed milk, unapologetically strong" },
  { n: "Flat White", c: "Coffee & Cold", v: [["Regular", 195]], d: "Double ristretto, steamed milk, thin microfoam" },
  { n: "Cold Brew", c: "Coffee & Cold", v: [["Regular", 215], ["Large", 275]], d: "18-hour steeped single origin, served over ice" },
  { n: "Masala Chai", c: "Coffee & Cold", v: [["Cutting", 95], ["Full", 135]], d: "Boiled with ginger, cardamom and clove" },
  { n: "Fresh Lime Soda", c: "Coffee & Cold", v: [["Sweet", 135], ["Salted", 135]], d: "Hand-squeezed lime, chilled soda, mint sprig" },
  // ---- non-veg kitchen ----
  { n: "Eggs Benedict", c: "Eggs & Benedicts", v: [["Two eggs", 365]], d: "Poached eggs, English muffin, hollandaise, chives" },
  { n: "Shakshuka", c: "Eggs & Benedicts", v: [["Regular", 335]], d: "Eggs baked in spiced tomato and pepper, warm pita to mop" },
  { n: "Bacon & Egg Muffin", c: "Eggs & Benedicts", v: [["Regular", 285]], d: "Fried egg, streaky bacon, cheddar, toasted muffin" },
  { n: "Masala Omelette & Toast", c: "Eggs & Benedicts", v: [["Two egg", 225], ["Three egg", 265]], d: "Onion, chilli, coriander, buttered toast on the side" },
  { n: "Chicken Malai Skewers", c: "Grills & Skewers", v: [["6 pc", 425], ["12 pc", 775]], d: "Cream cheese and cardamom marinade, charred over coal" },
  { n: "Peri Peri Chicken Wings", c: "Grills & Skewers", v: [["6 pc", 385], ["12 pc", 695]], d: "Double-fried, tossed in house peri peri, lime aioli" },
  { n: "Garlic Butter Prawns", c: "Grills & Skewers", v: [["Regular", 495]], d: "Seared prawns, garlic butter, dry chilli, lemon on the side" },
  { n: "Butter Chicken & Paratha", c: "Chicken Mains", v: [["Half", 485], ["Full", 795]], d: "Tandoori chicken in tomato-butter gravy, two laccha parathas" },
  { n: "Chicken Alfredo Penne", c: "Chicken Mains", v: [["Regular", 455]], d: "Cream sauce, parmesan, herb-grilled chicken breast" },
  { n: "Grilled Fish & Greens", c: "Chicken Mains", v: [["Regular", 525]], d: "Basa fillet, lemon butter sauce, sautéed seasonal greens" },
];

export async function seedDemoCafe(prisma: PrismaClient) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    // The theme is the point of this tenant, so it is re-applied on every run
    // (name/tagline too) — the menu below is what stays create-once.
    update: { name: "Demo Cafe", tagline: "A Neighbourhood Coffee House", theme: THEME },
    create: {
      slug: SLUG,
      name: "Demo Cafe",
      tagline: "A Neighbourhood Coffee House",
      theme: THEME,
      currency: "INR",
      gstPercent: GST_PERCENT,
      timezone: "Asia/Kolkata",
      splitKitchen: true,
      status: "active",
    },
  });

  // ── Categories ────────────────────────────────────────────────────
  const catByName = new Map<string, { id: string; isVeg: boolean }>();
  for (let i = 0; i < CATS.length; i++) {
    const c = CATS[i];
    const row = await prisma.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: c.n } },
      update: { sortOrder: i, isVeg: c.veg },
      create: { tenantId: tenant.id, name: c.n, isVeg: c.veg, sortOrder: i },
    });
    catByName.set(c.n, { id: row.id, isVeg: row.isVeg });
  }

  // ── Menu items + variants ─────────────────────────────────────────
  // MenuItem has no natural unique key to upsert on, so this is guarded by a
  // count instead — a second run must not double the menu.
  const existingItems = await prisma.menuItem.count({ where: { tenantId: tenant.id } });
  if (existingItems === 0) {
    for (let i = 0; i < CATALOG.length; i++) {
      const d = CATALOG[i];
      const cat = catByName.get(d.c)!;
      const item = await prisma.menuItem.create({
        data: { tenantId: tenant.id, categoryId: cat.id, name: d.n, description: d.d, isVeg: cat.isVeg, sortOrder: i },
      });
      for (let j = 0; j < d.v.length; j++) {
        const [label, priceRupees] = d.v[j];
        await prisma.itemVariant.create({
          data: { tenantId: tenant.id, itemId: item.id, label, pricePaise: rupeesToPaise(priceRupees), sortOrder: j },
        });
      }
    }
  }

  // ── Tables ────────────────────────────────────────────────────────
  for (let n = 1; n <= 12; n++) {
    const label = String(n).padStart(2, "0");
    await prisma.cafeTable.upsert({
      where: { tenantId_label: { tenantId: tenant.id, label } },
      update: {},
      create: { tenantId: tenant.id, label, qrToken: randomHex(32), active: true },
    });
  }

  // ── Staff ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const staff: { email: string; fullName: string; role: "owner" | "kitchen"; station?: "veg" | "nonveg" }[] = [
    { email: "owner@democafe.test", fullName: "Neha Sharma", role: "owner" },
    { email: "veg@democafe.test", fullName: "Arun Pillai", role: "kitchen", station: "veg" },
    { email: "grill@democafe.test", fullName: "Sameer Khan", role: "kitchen", station: "nonveg" },
  ];
  for (const s of staff) {
    await prisma.profile.upsert({
      where: { email: s.email },
      update: {},
      create: { tenantId: tenant.id, fullName: s.fullName, email: s.email, passwordHash, role: s.role, station: s.station },
    });
  }

  // ── Subscription ──────────────────────────────────────────────────
  // Depends on the `plans` rows seeded by seed.ts; skipped if they aren't there.
  const starter = await prisma.plan.findUnique({ where: { id: "starter" } });
  if (starter) {
    const now = new Date();
    await prisma.subscription.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        planId: starter.id,
        status: "active",
        currentStart: now,
        currentEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
  }

  const firstTable = await prisma.cafeTable.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { label: "asc" },
    select: { label: true, qrToken: true },
  });

  return { tenantId: tenant.id, slug: SLUG, firstTable };
}
