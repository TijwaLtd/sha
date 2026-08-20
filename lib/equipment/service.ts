import { createDbClient } from "@/lib/db"

export interface EquipmentCheck {
  equipmentTypeCode: string
  equipmentTypeName: string
  isRequired: boolean
  totalQuantity: number
  operationalQuantity: number
  hasMaintenance: boolean
  isAvailable: boolean
  minQuantityRequired: number
}

export interface EquipmentSignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

export async function checkEquipmentAvailability(
  hospitalId: string,
  serviceId: string,
  claimDate: Date = new Date()
): Promise<EquipmentCheck[]> {
  const db = createDbClient()

  const serviceEquipment = await db.serviceEquipment.findMany({
    where: { serviceId },
    include: { equipmentType: true },
  })

  const results: EquipmentCheck[] = []

  for (const se of serviceEquipment) {
    const hospitalEquipment = await db.hospitalEquipment.findFirst({
      where: {
        hospitalId,
        equipmentTypeId: se.equipmentTypeId,
      },
      include: {
        maintenance: {
          where: {
            startDate: { lte: claimDate },
            OR: [
              { endDate: null },
              { endDate: { gte: claimDate } },
            ],
          },
        },
      },
    })

    const totalQty = hospitalEquipment?.quantity ?? 0
    const operationalQty = hospitalEquipment?.operationalQuantity ?? 0
    const hasMaintenance = (hospitalEquipment?.maintenance.length ?? 0) > 0

    const effectiveOperational = hasMaintenance
      ? Math.max(0, operationalQty - 1)
      : operationalQty

    results.push({
      equipmentTypeCode: se.equipmentType.code,
      equipmentTypeName: se.equipmentType.name,
      isRequired: se.isRequired,
      totalQuantity: totalQty,
      operationalQuantity: effectiveOperational,
      hasMaintenance,
      isAvailable: effectiveOperational >= se.minQuantity,
      minQuantityRequired: se.minQuantity,
    })
  }

  return results
}

export async function evaluateEquipmentSignals(
  hospitalId: string,
  serviceId: string,
  claimQuantity: number = 1,
  claimDate: Date = new Date()
): Promise<EquipmentSignal[]> {
  const checks = await checkEquipmentAvailability(hospitalId, serviceId, claimDate)
  const signals: EquipmentSignal[] = []

  for (const check of checks) {
    if (check.isRequired && !check.isAvailable) {
      signals.push({
        signal: "EQUIPMENT_UNAVAILABLE",
        severity: "HIGH",
        expected: check.minQuantityRequired,
        observed: check.operationalQuantity,
        explanation: `Required equipment ${check.equipmentTypeName} is unavailable (${check.operationalQuantity} operational, ${check.minQuantityRequired} required)`,
      })
    }

    if (check.isRequired && check.operationalQuantity > 0) {
      const capacityRatio = claimQuantity / check.operationalQuantity
      if (capacityRatio > 1) {
        signals.push({
          signal: "EQUIPMENT_CAPACITY_EXCEEDED",
          severity: capacityRatio > 2 ? "CRITICAL" : "MEDIUM",
          expected: check.operationalQuantity,
          observed: claimQuantity,
          explanation: `Claimed quantity (${claimQuantity}) exceeds operational equipment count (${check.operationalQuantity}) for ${check.equipmentTypeName}`,
        })
      }
    }
  }

  return signals
}
