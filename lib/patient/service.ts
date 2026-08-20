import { createDbClient } from "@/lib/db"

export interface PatientHistorySummary {
  patientId: string
  totalEncounters: number
  totalClaims: number
  totalClaimedCents: number
  totalApprovedCents: number
  serviceFrequency: Array<{
    serviceCode: string
    serviceName: string
    count: number
    totalAmountCents: number
    lastDate: Date
  }>
  recentServices: Array<{
    serviceCode: string
    claimDate: Date
    amountCents: number
  }>
}

export interface PatientSignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

const FREQUENCY_THRESHOLD = 5
const SPENDING_THRESHOLD_CENTS = 5000000
const DAYS_LOOKBACK = 90

export async function getPatientHistorySummary(
  patientId: string,
  lookbackDays: number = DAYS_LOOKBACK
): Promise<PatientHistorySummary> {
  const db = createDbClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - lookbackDays)

  const patient = await db.patient.findUnique({ where: { id: patientId } })
  if (!patient) throw new Error("Patient not found")

  const encounters = await db.encounter.findMany({
    where: { patientId, encounterDate: { gte: cutoff } },
  })

  const claims = await db.claim.findMany({
    where: {
      patientId,
      submittedAt: { gte: cutoff },
      status: { notIn: ["DRAFT"] },
    },
    include: { items: { include: { service: true } } },
  })

  const serviceMap = new Map<string, {
    serviceCode: string
    serviceName: string
    count: number
    totalAmountCents: number
    lastDate: Date
  }>()

  const recentServices: PatientHistorySummary["recentServices"] = []

  for (const claim of claims) {
    for (const item of claim.items) {
      const key = item.service.code
      const existing = serviceMap.get(key)
      if (existing) {
        existing.count += item.quantity
        existing.totalAmountCents += item.totalAmountCents
        if (claim.submittedAt && claim.submittedAt > existing.lastDate) {
          existing.lastDate = claim.submittedAt
        }
      } else {
        serviceMap.set(key, {
          serviceCode: item.service.code,
          serviceName: item.service.name,
          count: item.quantity,
          totalAmountCents: item.totalAmountCents,
          lastDate: claim.submittedAt ?? new Date(),
        })
      }

      if (claim.submittedAt) {
        recentServices.push({
          serviceCode: item.service.code,
          claimDate: claim.submittedAt,
          amountCents: item.totalAmountCents,
        })
      }
    }
  }

  const totalClaimedCents = claims.reduce((sum, c) => sum + c.totalAmountCents, 0)
  const totalApprovedCents = claims.reduce((sum, c) => sum + c.approvedAmountCents, 0)

  return {
    patientId,
    totalEncounters: encounters.length,
    totalClaims: claims.length,
    totalClaimedCents,
    totalApprovedCents,
    serviceFrequency: Array.from(serviceMap.values()),
    recentServices: recentServices.sort((a, b) => b.claimDate.getTime() - a.claimDate.getTime()),
  }
}

export async function evaluatePatientSignals(
  patientId: string,
  serviceCode: string,
  claimAmountCents: number,
  claimDate: Date = new Date()
): Promise<PatientSignal[]> {
  const history = await getPatientHistorySummary(patientId)
  const signals: PatientSignal[] = []

  const serviceFreq = history.serviceFrequency.find(s => s.serviceCode === serviceCode)
  if (serviceFreq && serviceFreq.count >= FREQUENCY_THRESHOLD) {
    signals.push({
      signal: "PATIENT_SERVICE_FREQUENCY_ANOMALY",
      severity: serviceFreq.count >= FREQUENCY_THRESHOLD * 2 ? "HIGH" : "MEDIUM",
      expected: FREQUENCY_THRESHOLD,
      observed: serviceFreq.count,
      explanation: `Patient has received ${serviceFreq.count} ${serviceCode} services in the last ${DAYS_LOOKBACK} days (threshold: ${FREQUENCY_THRESHOLD})`,
    })
  }

  if (history.totalClaimedCents >= SPENDING_THRESHOLD_CENTS) {
    signals.push({
      signal: "PATIENT_SPENDING_ANOMALY",
      severity: "MEDIUM",
      expected: SPENDING_THRESHOLD_CENTS,
      observed: history.totalClaimedCents,
      explanation: `Patient total spending KES ${(history.totalClaimedCents / 100).toFixed(0)} exceeds threshold KES ${(SPENDING_THRESHOLD_CENTS / 100).toFixed(0)}`,
    })
  }

  return signals
}
