import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: connection URLs live here, not in schema.prisma.
// DIRECT_URL (port 5432) for migrations; runtime uses the pg adapter in src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
