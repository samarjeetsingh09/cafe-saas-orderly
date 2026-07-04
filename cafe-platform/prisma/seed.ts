/**
 * Dev seed: 1 test cafe, 3 tables, 2 categories, 6 menu items, 1 founder admin.
 * Run: npm run db:seed
 * Logins (dev only): owner 9999900001 / owner123 · admin 9999900000 / admin123
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

function randomToken(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function main() {
  const cafe = await prisma.cafe.upsert({
    where: { slug: "demo-cafe" },
    update: {},
    create: {
      name: "Demo Cafe",
      slug: "demo-cafe",
      ownerName: "Rohit Sharma",
      phone: "9999900001",
      passwordHash: await bcrypt.hash("owner123", 10),
      address: "12 MG Road, Pune",
      setupFeeAmount: 1500,
      setupFeeAdvancePaid: true,
      setupFeeFullPaid: true,
      subscriptionStatus: "active",
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subscriptionAmount: 999,
      menuEnabled: true,
      tables: {
        create: [1, 2, 3].map((n) => ({
          tableNumber: String(n),
          qrToken: randomToken(),
        })),
      },
    },
  });

  const beverages = await prisma.category.create({
    data: { cafeId: cafe.id, name: "Beverages", displayOrder: 1 },
  });
  const starters = await prisma.category.create({
    data: { cafeId: cafe.id, name: "Starters", displayOrder: 2 },
  });

  await prisma.menuItem.createMany({
    data: [
      { cafeId: cafe.id, categoryId: beverages.id, name: "Masala Chai", price: 40, isVeg: true, displayOrder: 1 },
      { cafeId: cafe.id, categoryId: beverages.id, name: "Cold Coffee", price: 120, isVeg: true, displayOrder: 2 },
      { cafeId: cafe.id, categoryId: beverages.id, name: "Fresh Lime Soda", price: 80, isVeg: true, displayOrder: 3 },
      { cafeId: cafe.id, categoryId: starters.id, name: "Paneer Tikka", price: 220, isVeg: true, displayOrder: 1 },
      { cafeId: cafe.id, categoryId: starters.id, name: "Chicken 65", price: 260, isVeg: false, displayOrder: 2 },
      { cafeId: cafe.id, categoryId: starters.id, name: "French Fries", price: 110, isVeg: true, displayOrder: 3, isAvailable: false },
    ],
  });

  await prisma.admin.upsert({
    where: { phone: "9999900000" },
    update: {},
    create: {
      name: "Founder",
      phone: "9999900000",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "founder",
    },
  });

  const tables = await prisma.table.findMany({ where: { cafeId: cafe.id } });
  console.log("Seeded Demo Cafe. Table QR URLs:");
  for (const t of tables) {
    console.log(`  Table ${t.tableNumber}: /demo-cafe/t/${t.qrToken}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
