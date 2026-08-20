import { createDbClient } from "@/lib/db"

export interface TariffResult {
  serviceCode: string
  facilityLevelCode: string | null
  unitAmountCents: number
  minAmountCents: number | null
  maxAmountCents: number | null
  source: string | null
  effectiveFrom: Date
  effectiveTo: Date | null
}

export interface TariffSignal {
  signal: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  expected: unknown
  observed: unknown
  explanation: string
}

export async function getApplicableTariff(
  serviceId: string,
  facilityLevelId: string | null,
  hospitalId: string | null,
  claimDate: Date = new Date()
): Promise<TariffResult | null> {
  const db = createDbClient()

  const where: Record<string, unknown> = {
    serviceId,
    active: true,
    effectiveFrom: { lte: claimDate },
    OR: [
      { effectiveTo: null },
      { effectiveTo: { gte: claimDate } },
    ],
  }

  const hospitalTariff = hospitalId
    ? await db.serviceTariff.findFirst({
        where: { ...where, hospitalId },
        orderBy: { effectiveFrom: "desc" },
      })
    : null

  if (hospitalTariff) {
    return {
      serviceCode: (await db.service.findUnique({ where: { id: serviceId } }))?.code ?? "",
      facilityLevelCode: null,
      unitAmountCents: hospitalTariff.unitAmountCents,
      minAmountCents: hospitalTariff.minAmountCents,
      maxAmountCents: hospitalTariff.maxAmountCents,
      source: hospitalTariff.source,
      effectiveFrom: hospitalTariff.effectiveFrom,
      effectiveTo: hospitalTariff.effectiveTo,
    }
  }

  const levelTariff = facilityLevelId
    ? await db.serviceTariff.findFirst({
        where: { ...where, facilityLevelId, hospitalId: null },
        orderBy: { effectiveFrom: "desc" },
      })
    : null

  if (levelTariff) {
    const service = await db.service.findUnique({ where: { id: serviceId } })
    return {
      serviceCode: service?.code ?? "",
      facilityLevelCode: null,
      unitAmountCents: levelTariff.unitAmountCents,
      minAmountCents: levelTariff.minAmountCents,
      maxAmountCents: levelTariff.maxAmountCents,
      source: levelTariff.source,
      effectiveFrom: levelTariff.effectiveFrom,
      effectiveTo: levelTariff.effectiveTo,
    }
  }

  const globalTariff = await db.serviceTariff.findFirst({
    where: { ...where, facilityLevelId: null, hospitalId: null },
    orderBy: { effectiveFrom: "desc" },
  })

  if (globalTariff) {
    const service = await db.service.findUnique({ where: { id: serviceId } })
    return {
      serviceCode: service?.code ?? "",
      facilityLevelCode: null,
      unitAmountCents: globalTariff.unitAmountCents,
      minAmountCents: globalTariff.minAmountCents,
      maxAmountCents: globalTariff.maxAmountCents,
      source: globalTariff.source,
      effectiveFrom: globalTariff.effectiveFrom,
      effectiveTo: globalTariff.effectiveTo,
    }
  }

  return null
}

export async function evaluateTariffSignals(
  serviceId: string,
  facilityLevelId: string | null,
  hospitalId: string | null,
  unitAmountCents: number,
  quantity: number,
  claimDate: Date = new Date()
): Promise<TariffSignal[]> {
  const tariff = await getApplicableTariff(serviceId, facilityLevelId, hospitalId, claimDate)
  const signals: TariffSignal[] = []

  if (!tariff) return signals

  const totalClaimed = unitAmountCents * quantity

  if (tariff.maxAmountCents && unitAmountCents > tariff.maxAmountCents) {
    signals.push({
      signal: "TARIFF_EXCEEDED",
      severity: "HIGH",
      expected: tariff.maxAmountCents,
      observed: unitAmountCents,
      explanation: `Unit amount KES ${(unitAmountCents / 100).toFixed(0)} exceeds maximum tariff KES ${(tariff.maxAmountCents / 100).toFixed(0)}`,
    })
  }

  if (tariff.minAmountCents && unitAmountCents < tariff.minAmountCents) {
    signals.push({
      signal: "TARIFF_EXCEEDED",
      severity: "MEDIUM",
      expected: tariff.minAmountCents,
      observed: unitAmountCents,
      explanation: `Unit amount KES ${(unitAmountCents / 100).toFixed(0)} is below minimum tariff KES ${(tariff.minAmountCents / 100).toFixed(0)}`,
    })
  }

  if (tariff.maxAmountCents && totalClaimed > tariff.maxAmountCents * quantity) {
    signals.push({
      signal: "TARIFF_EXCEEDED",
      severity: "HIGH",
      expected: tariff.maxAmountCents * quantity,
      observed: totalClaimed,
      explanation: `Total claimed KES ${(totalClaimed / 100).toFixed(0)} exceeds tariff limit`,
    })
  }

  return signals
}
