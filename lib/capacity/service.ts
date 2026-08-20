import { createDbClient } from "@/lib/db"

export interface CapacityCheck {
  hospitalId: string
  serviceCode: string
  theoreticalDaily: number | null
  operationalDaily: number | null
  monthlyCapacity: number | null
  capacityBasis: string
}

export interface CapacitySignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

export async function getServiceCapacity(
  hospitalId: string,
  serviceId: string,
  claimDate: Date = new Date()
): Promise<CapacityCheck | null> {
  const db = createDbClient()

  const capacity = await db.serviceCapacity.findFirst({
    where: {
      hospitalId,
      serviceId,
      effectiveFrom: { lte: claimDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: claimDate } },
      ],
    },
    include: { service: true, hospital: true },
  })

  if (!capacity) return null

  return {
    hospitalId,
    serviceCode: capacity.service.code,
    theoreticalDaily: capacity.theoreticalDailyCapacity,
    operationalDaily: capacity.operationalDailyCapacity,
    monthlyCapacity: capacity.monthlyCapacity,
    capacityBasis: capacity.capacityBasis,
  }
}

export async function evaluateCapacitySignals(
  hospitalId: string,
  serviceId: string,
  claimedQuantity: number,
  claimDate: Date = new Date()
): Promise<CapacitySignal[]> {
  const capacity = await getServiceCapacity(hospitalId, serviceId, claimDate)
  const signals: CapacitySignal[] = []

  if (!capacity) return signals

  if (capacity.operationalDaily && claimedQuantity > capacity.operationalDaily) {
    signals.push({
      signal: "SERVICE_CAPACITY_EXCEEDED",
      severity: claimedQuantity > capacity.operationalDaily * 2 ? "CRITICAL" : "HIGH",
      expected: capacity.operationalDaily,
      observed: claimedQuantity,
      explanation: `Claimed quantity (${claimedQuantity}) exceeds operational daily capacity (${capacity.operationalDaily})`,
    })
  }

  if (capacity.theoreticalDaily && claimedQuantity > capacity.theoreticalDaily) {
    signals.push({
      signal: "SERVICE_CAPACITY_EXCEEDED",
      severity: "HIGH",
      expected: capacity.theoreticalDaily,
      observed: claimedQuantity,
      explanation: `Claimed quantity (${claimedQuantity}) exceeds theoretical daily capacity (${capacity.theoreticalDaily})`,
    })
  }

  return signals
}

export async function getFacilityDailyClaimCount(
  hospitalId: string,
  claimDate: Date = new Date()
): Promise<number> {
  const db = createDbClient()

  const startOfDay = new Date(claimDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(claimDate)
  endOfDay.setHours(23, 59, 59, 999)

  const count = await db.claim.count({
    where: {
      hospitalId,
      submittedAt: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["DRAFT"] },
    },
  })

  return count
}

export async function getFacilityMonthlyClaimCount(
  hospitalId: string,
  claimDate: Date = new Date()
): Promise<number> {
  const db = createDbClient()

  const startOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth(), 1)
  const endOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth() + 1, 0, 23, 59, 59, 999)

  const count = await db.claim.count({
    where: {
      hospitalId,
      submittedAt: { gte: startOfMonth, lte: endOfMonth },
      status: { notIn: ["DRAFT"] },
    },
  })

  return count
}
