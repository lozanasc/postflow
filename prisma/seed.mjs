import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { hashPassword } from "better-auth/dist/crypto/index.mjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

const email = "test@postflow.com"
const password = "testingpassword"
const name = "Test User"

async function seed() {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log("User already exists:", email)
    await db.$disconnect()
    return
  }

  const hashed = await hashPassword(password)
  const now = new Date()

  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: email,
          providerId: "credential",
          password: hashed,
          createdAt: now,
          updatedAt: now,
        },
      },
    },
  })

  console.log("Created user:", user.email)
  await db.$disconnect()
}

seed().catch((e) => { console.error(e); process.exit(1) })
