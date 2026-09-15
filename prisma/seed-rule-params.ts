import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding missing rule parameters...")

  // Get existing rules
  const rules = await prisma.complianceRule.findMany()
  const ruleMap = Object.fromEntries(rules.map((r) => [r.code, r]))

  console.log(`Found ${rules.length} existing rules`)

  // Define required parameters
  const requiredParams = [
    { ruleCode: "R-003", key: "lookbackDays", value: "5" },
    { ruleCode: "R-007", key: "lookbackDays", value: "7" },
    { ruleCode: "R-004", key: "thresholdCents", value: "75000000" },
    { ruleCode: "R-005", key: "maxQuantity", value: "10" },
  ]

  let createdCount = 0
  let skippedCount = 0

  for (const param of requiredParams) {
    const rule = ruleMap[param.ruleCode]
    if (!rule) {
      console.log(`Skipping ${param.ruleCode} - rule not found`)
      skippedCount++
      continue
    }

    // Check if parameter already exists
    const existing = await prisma.ruleParameter.findFirst({
      where: {
        complianceRuleId: rule.id,
        key: param.key,
      },
    })

    if (existing) {
      console.log(`Skipping ${param.ruleCode}.${param.key} - already exists`)
      skippedCount++
      continue
    }

    // Create the parameter
    await prisma.ruleParameter.create({
      data: {
        complianceRuleId: rule.id,
        key: param.key,
        value: param.value,
      },
    })
    console.log(`Created ${param.ruleCode}.${param.key} = ${param.value}`)
    createdCount++
  }

  console.log("Seed completed successfully!")
  console.log(`  Created: ${createdCount} parameters`)
  console.log(`  Skipped: ${skippedCount} parameters`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
