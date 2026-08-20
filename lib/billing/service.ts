import { createDbClient } from "@/lib/db"

export interface BillingPolicyResult {
  maxPerEncounter: number | null
  maxPerService: number | null
  maxQtyPerService: number | null
  maxDailyAmount: number | null
  maxDailyQuantity: number | null
  maxMonthlyAmount: number | null
  maxMonthlyQuantity: number | null
}

export interface BillingSignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

export async function getApplicableBillingPolicy(
  facilityLevelId: string | null,
  serviceId: string | null,
  hospitalId: string | null,
  claimDate: Date = new Date()
): Promise<BillingPolicyResult> {
  const db = createDbClient()

  const where: Record<string, unknown> = {
    active: true,
    effectiveFrom: { lte: claimDate },
    OR: [
      { effectiveTo: null },
      { effectiveTo: { gte: claimDate } },
    ],
  }

  const defaults: BillingPolicyResult = {
    maxPerEncounter: null,
    maxPerService: null,
    maxQtyPerService: null,
    maxDailyAmount: null,
    maxDailyQuantity: null,
    maxMonthlyAmount: null,
    maxMonthlyQuantity: null,
  }

  const globalPolicy = await db.billingPolicy.findFirst({
    where: { ...where, facilityLevelId: null, serviceId: null, hospitalId: null },
    orderBy: { effectiveFrom: "desc" },
  })

  if (globalPolicy) {
    defaults.maxPerEncounter = globalPolicy.maxPerEncounter
    defaults.maxDailyAmount = globalPolicy.maxDailyAmount
    defaults.maxDailyQuantity = globalPolicy.maxDailyQuantity
    defaults.maxMonthlyAmount = globalPolicy.maxMonthlyAmount
    defaults.maxMonthlyQuantity = globalPolicy.maxMonthlyQuantity
  }

  if (facilityLevelId) {
    const levelPolicy = await db.billingPolicy.findFirst({
      where: { ...where, facilityLevelId, serviceId: null, hospitalId: null },
      orderBy: { effectiveFrom: "desc" },
    })
    if (levelPolicy) {
      if (levelPolicy.maxPerEncounter) defaults.maxPerEncounter = levelPolicy.maxPerEncounter
      if (levelPolicy.maxDailyAmount) defaults.maxDailyAmount = levelPolicy.maxDailyAmount
      if (levelPolicy.maxDailyQuantity) defaults.maxDailyQuantity = levelPolicy.maxDailyQuantity
      if (levelPolicy.maxMonthlyAmount) defaults.maxMonthlyAmount = levelPolicy.maxMonthlyAmount
      if (levelPolicy.maxMonthlyQuantity) defaults.maxMonthlyQuantity = levelPolicy.maxMonthlyQuantity
    }
  }

  if (serviceId) {
    const servicePolicy = await db.billingPolicy.findFirst({
      where: { ...where, serviceId, hospitalId: null },
      orderBy: { effectiveFrom: "desc" },
    })
    if (servicePolicy) {
      if (servicePolicy.maxPerService) defaults.maxPerService = servicePolicy.maxPerService
      if (servicePolicy.maxQtyPerService) defaults.maxQtyPerService = servicePolicy.maxQtyPerService
    }
  }

  if (hospitalId) {
    const hospitalPolicy = await db.billingPolicy.findFirst({
      where: { ...where, hospitalId },
      orderBy: { effectiveFrom: "desc" },
    })
    if (hospitalPolicy) {
      if (hospitalPolicy.maxPerEncounter) defaults.maxPerEncounter = hospitalPolicy.maxPerEncounter
      if (hospitalPolicy.maxPerService) defaults.maxPerService = hospitalPolicy.maxPerService
      if (hospitalPolicy.maxDailyAmount) defaults.maxDailyAmount = hospitalPolicy.maxDailyAmount
      if (hospitalPolicy.maxMonthlyAmount) defaults.maxMonthlyAmount = hospitalPolicy.maxMonthlyAmount
    }
  }

  return defaults
}

export async function evaluateBillingSignals(
  hospitalId: string,
  facilityLevelId: string | null,
  serviceId: string,
  totalAmountCents: number,
  quantity: number,
  claimDate: Date = new Date()
): Promise<BillingSignal[]> {
  const policy = await getApplicableBillingPolicy(facilityLevelId, serviceId, hospitalId, claimDate)
  const signals: BillingSignal[] = []

  if (policy.maxPerService && totalAmountCents > policy.maxPerService) {
    signals.push({
      signal: "ENCOUNTER_BILLING_LIMIT_EXCEEDED",
      severity: "HIGH",
      expected: policy.maxPerService,
      observed: totalAmountCents,
      explanation: `Service total KES ${(totalAmountCents / 100).toFixed(0)} exceeds per-service limit KES ${(policy.maxPerService / 100).toFixed(0)}`,
    })
  }

  if (policy.maxQtyPerService && quantity > policy.maxQtyPerService) {
    signals.push({
      signal: "ENCOUNTER_BILLING_LIMIT_EXCEEDED",
      severity: "MEDIUM",
      expected: policy.maxQtyPerService,
      observed: quantity,
      explanation: `Service quantity ${quantity} exceeds maximum ${policy.maxQtyPerService}`,
    })
  }

  const dailyTotal = await getHospitalDailyTotal(hospitalId, claimDate)
  if (policy.maxDailyAmount && dailyTotal + totalAmountCents > policy.maxDailyAmount) {
    signals.push({
      signal: "DAILY_BILLING_LIMIT_EXCEEDED",
      severity: "HIGH",
      expected: policy.maxDailyAmount,
      observed: dailyTotal + totalAmountCents,
      explanation: `Daily total KES ${((dailyTotal + totalAmountCents) / 100).toFixed(0)} exceeds daily limit KES ${(policy.maxDailyAmount / 100).toFixed(0)}`,
    })
  }

  const monthlyTotal = await getHospitalMonthlyTotal(hospitalId, claimDate)
  if (policy.maxMonthlyAmount && monthlyTotal + totalAmountCents > policy.maxMonthlyAmount) {
    signals.push({
      signal: "MONTHLY_BILLING_LIMIT_EXCEEDED",
      severity: "HIGH",
      expected: policy.maxMonthlyAmount,
      observed: monthlyTotal + totalAmountCents,
      explanation: `Monthly total KES ${((monthlyTotal + totalAmountCents) / 100).toFixed(0)} exceeds monthly limit KES ${(policy.maxMonthlyAmount / 100).toFixed(0)}`,
    })
  }

  return signals
}

async function getHospitalDailyTotal(hospitalId: string, claimDate: Date): Promise<number> {
  const db = createDbClient()
  const startOfDay = new Date(claimDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(claimDate)
  endOfDay.setHours(23, 59, 59, 999)

  const result = await db.claim.aggregate({
    where: {
      hospitalId,
      submittedAt: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["DRAFT"] },
    },
    _sum: { totalAmountCents: true },
  })

  return result._sum.totalAmountCents ?? 0
}

async function getHospitalMonthlyTotal(hospitalId: string, claimDate: Date): Promise<number> {
  const db = createDbClient()
  const startOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth(), 1)
  const endOfMonth = new Date(claimDate.getFullYear(), claimDate.getMonth() + 1, 0, 23, 59, 59, 999)

  const result = await db.claim.aggregate({
    where: {
      hospitalId,
      submittedAt: { gte: startOfMonth, lte: endOfMonth },
      status: { notIn: ["DRAFT"] },
    },
    _sum: { totalAmountCents: true },
  })

  return result._sum.totalAmountCents ?? 0
}
