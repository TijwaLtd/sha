import { createDbClient } from "@/lib/db"

export interface CapabilityCheck {
  serviceCode: string
  serviceName: string
  isExpected: boolean
  isAllowed: boolean
  isOffered: boolean
  isAccredited: boolean
  requiresAccreditation: boolean
  isSatisfied: boolean
}

export interface CapabilitySignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

export async function checkHospitalCapability(
  hospitalId: string,
  serviceCode: string,
  claimDate: Date = new Date()
): Promise<CapabilityCheck> {
  const db = createDbClient()

  const hospital = await db.hospital.findUnique({
    where: { id: hospitalId },
    include: { facilityLevel: true },
  })
  if (!hospital) throw new Error("Hospital not found")

  const service = await db.service.findUnique({ where: { code: serviceCode } })
  if (!service) throw new Error(`Service ${serviceCode} not found`)

  const levelCapability = hospital.facilityLevelId
    ? await db.facilityLevelCapability.findFirst({
        where: {
          facilityLevelId: hospital.facilityLevelId,
          serviceId: service.id,
          active: true,
          effectiveFrom: { lte: claimDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: claimDate } },
          ],
        },
      })
    : null

  const hospitalCapability = await db.hospitalServiceCapability.findFirst({
    where: {
      hospitalId,
      serviceId: service.id,
      isActive: true,
      effectiveFrom: { lte: claimDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: claimDate } },
      ],
    },
  })

  const isExpected = levelCapability?.isExpected ?? false
  const isAllowed = levelCapability?.isAllowed ?? false
  const requiresAccreditation = levelCapability?.requiresAccreditation ?? false
  const isOffered = hospitalCapability?.isOffered ?? false
  const isAccredited = hospitalCapability?.isAccredited ?? false

  const isSatisfied = isOffered && (!requiresAccreditation || isAccredited)

  return {
    serviceCode,
    serviceName: service.name,
    isExpected,
    isAllowed,
    isOffered,
    isAccredited,
    requiresAccreditation,
    isSatisfied,
  }
}

export async function evaluateCapabilitySignals(
  hospitalId: string,
  serviceCode: string,
  claimDate: Date = new Date()
): Promise<CapabilitySignal[]> {
  const check = await checkHospitalCapability(hospitalId, serviceCode, claimDate)
  const signals: CapabilitySignal[] = []

  if (!check.isOffered) {
    signals.push({
      signal: "SERVICE_NOT_OFFERED",
      severity: "HIGH",
      expected: true,
      observed: false,
      explanation: `${check.serviceName} is not offered by this facility`,
    })
  }

  if (check.requiresAccreditation && !check.isAccredited) {
    signals.push({
      signal: "SERVICE_NOT_ACCREDITED",
      severity: "HIGH",
      expected: true,
      observed: false,
      explanation: `${check.serviceName} requires accreditation which this facility does not have`,
    })
  }

  if (!check.isAllowed) {
    signals.push({
      signal: "FACILITY_LEVEL_MISMATCH",
      severity: "MEDIUM",
      expected: "allowed",
      observed: "not allowed",
      explanation: `${check.serviceName} is not allowed for this facility level`,
    })
  }

  return signals
}
