import { defineConfig } from "prisma/config"

// DATABASE_URL must be set in environment when running Prisma CLI commands.
// Use: DATABASE_URL="..." npx prisma migrate dev
export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
})
