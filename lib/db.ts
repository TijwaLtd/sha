import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

let prisma: PrismaClient | null = null

export function createDbClient() {
  if (prisma) return prisma

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  prisma = new PrismaClient({ adapter })
  return prisma
}
