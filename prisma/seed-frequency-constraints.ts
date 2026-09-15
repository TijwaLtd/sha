import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding service frequency constraints...")

  // Get existing services
  const services = await prisma.service.findMany()
  const serviceMap = Object.fromEntries(services.map((s) => [s.code, s]))

  console.log(`Found ${services.length} existing services`)

  // Define frequency constraints for key services
  const constraintDefs = [
    { serviceCode: "SURGERY_MAJOR", minDays: 30, maxClaims: 2, periodDays: 365, notes: "Major surgical procedures - medical necessity unlikely within 30 days" },
    { serviceCode: "ORTHO_SURGERY", minDays: 30, maxClaims: 2, periodDays: 365, notes: "Orthopedic surgery - 30 day minimum for recovery" },
    { serviceCode: "DELIVERY_CS", minDays: 30, maxClaims: null, periodDays: null, notes: "Caesarean section - 30 day minimum between procedures" },
    { serviceCode: "SURGERY_MINOR", minDays: 14, maxClaims: null, periodDays: null, notes: "Minor surgical procedures - 14 day minimum for recovery" },
    { serviceCode: "CT_SCAN", minDays: 7, maxClaims: 4, periodDays: 90, notes: "Advanced imaging - 7 day minimum for clinical justification" },
    { serviceCode: "MRI", minDays: 7, maxClaims: 4, periodDays: 90, notes: "MRI scans - 7 day minimum between procedures" },
    { serviceCode: "X_RAY", minDays: 3, maxClaims: null, periodDays: null, notes: "Basic imaging - 3 day minimum" },
    { serviceCode: "ULTRASOUND", minDays: 3, maxClaims: null, periodDays: null, notes: "Ultrasound imaging - 3 day minimum" },
  ]

  let createdCount = 0
  let updatedCount = 0
  let skippedCount = 0

  for (const def of constraintDefs) {
    const service = serviceMap[def.serviceCode]
    if (!service) {
      console.log(`Skipping ${def.serviceCode} - service not found`)
      skippedCount++
      continue
    }

    // Check if constraint already exists
    const existing = await prisma.serviceFrequencyConstraint.findFirst({
      where: { serviceId: service.id },
    })

    if (existing) {
      // Update if different
      if (
        existing.minDaysBetweenClaims !== def.minDays ||
        existing.maxClaimsPerPeriod !== def.maxClaims ||
        existing.periodDays !== def.periodDays
      ) {
        await prisma.serviceFrequencyConstraint.update({
          where: { id: existing.id },
          data: {
            minDaysBetweenClaims: def.minDays,
            maxClaimsPerPeriod: def.maxClaims,
            periodDays: def.periodDays,
            notes: def.notes,
            severity: "HIGH",
            active: true,
          },
        })
        console.log(`Updated ${def.serviceCode} - frequency constraint`)
        updatedCount++
      } else {
        console.log(`Skipping ${def.serviceCode} - already exists with same values`)
        skippedCount++
      }
    } else {
      // Create new constraint
      await prisma.serviceFrequencyConstraint.create({
        data: {
          serviceId: service.id,
          minDaysBetweenClaims: def.minDays,
          maxClaimsPerPeriod: def.maxClaims,
          periodDays: def.periodDays,
          severity: "HIGH",
          active: true,
          notes: def.notes,
        },
      })
      console.log(`Created ${def.serviceCode} - frequency constraint`)
      createdCount++
    }
  }

  console.log("Seed completed successfully!")
  console.log(`  Created: ${createdCount} constraints`)
  console.log(`  Updated: ${updatedCount} constraints`)
  console.log(`  Skipped: ${skippedCount} constraints`)

  // Verify the constraints
  const allConstraints = await prisma.serviceFrequencyConstraint.findMany({
    include: { service: true },
  })
  console.log(`\nTotal frequency constraints in database: ${allConstraints.length}`)
  allConstraints.forEach((fc) => {
    console.log(`  ${fc.service.code}: ${fc.minDaysBetweenClaims} days min${fc.maxClaimsPerPeriod ? `, max ${fc.maxClaimsPerPeriod} per ${fc.periodDays} days` : ""}`)
  })
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
