/**
 * Standalone runner for the Cafiyara (demo cafe) tenant — `npm run db:seed:demo`.
 * Exists so the second tenant can be (re)created without re-running the full
 * Bëlla seed, which also generates ~150 orders. `npm run db:seed` calls the
 * same function at the end, so a fresh database gets both cafes.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedDemoCafe } from "./demo-cafe";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

seedDemoCafe(prisma)
  .then(({ slug, firstTable }) => {
    console.log(`\nCafiyara ready (slug: ${slug})`);
    if (firstTable) console.log(`Table ${firstTable.label} menu:  /t/${firstTable.qrToken}`);
    console.table([
      { role: "owner", email: "owner@democafe.test", password: "demo1234" },
      { role: "kitchen (veg)", email: "veg@democafe.test", password: "demo1234" },
      { role: "kitchen (nonveg)", email: "grill@democafe.test", password: "demo1234" },
    ]);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
