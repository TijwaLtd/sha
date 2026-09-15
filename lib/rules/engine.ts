import { createDbClient } from "@/lib/db"

type RuleParams = Record<string, string>

async function loadRuleParams(
  db: ReturnType<typeof createDbClient>,
  ruleId: string
): Promise<RuleParams> {
  const rows = await db.ruleParameter.findMany({
    where: { complianceRuleId: ruleId },
  })
  const params: RuleParams = {}
  for (const row of rows) {
    params[row.key] = row.value
  }
  return params
}

export async function evaluateClaimRules(claimId: string) {
  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      hospital: {
        include: {
          services: { include: { service: true } },
        },
      },
      items: { include: { service: true } },
    },
  })

  if (!claim) throw new Error("Claim not found")

  const rules = await db.complianceRule.findMany({
    where: { active: true },
  })

  const evaluations: Array<{
    ruleId: string
    triggered: boolean
    scoreImpact: number
    details: Record<string, unknown>
  }> = []

  for (const rule of rules) {
    const params = await loadRuleParams(db, rule.id)

    const result = await evaluateRule(db, rule.code, params, {
      claimId,
      hospitalId: claim.hospitalId,
      patientId: claim.patientId,
      patientReference: claim.patientReference,
      submittedAt: claim.submittedAt ?? claim.createdAt,
      hospital: claim.hospital,
      items: claim.items.map((item) => ({
        serviceId: item.serviceId,
        serviceCode: item.service.code,
        quantity: item.quantity,
        unitPriceCents: item.unitAmountCents,
      })),
      totalAmountCents: claim.totalAmountCents,
    })

    evaluations.push({
      ruleId: rule.id,
      triggered: result.triggered,
      scoreImpact: result.triggered ? rule.scoreContribution : 0,
      details: result.details,
    })
  }

  for (const eval_ of evaluations) {
    await db.claimRuleEvaluation.upsert({
      where: {
        claimId_complianceRuleId: {
          claimId,
          complianceRuleId: eval_.ruleId,
        },
      },
      update: {
        triggered: eval_.triggered,
        scoreContribution: eval_.scoreImpact,
        explanation: JSON.stringify(eval_.details),
      },
      create: {
        claimId,
        complianceRuleId: eval_.ruleId,
        triggered: eval_.triggered,
        scoreContribution: eval_.scoreImpact,
        explanation: JSON.stringify(eval_.details),
      },
    })
  }

  return evaluations
}

async function evaluateRule(
  db: ReturnType<typeof createDbClient>,
  ruleCode: string,
  params: RuleParams,
  claim: {
    claimId: string
    hospitalId: string
    patientId: string | null
    patientReference: string
    submittedAt: Date
    hospital: {
      status: string
      verificationStatus: string
      services: Array<{ service: { code: string } }>
    }
    items: Array<{ serviceId: string; serviceCode: string; quantity: number; unitPriceCents: number }>
    totalAmountCents: number
  }
): Promise<{ triggered: boolean; details: Record<string, unknown> }> {
  switch (ruleCode) {
    case "R-001": {
      const triggered = claim.hospital.verificationStatus !== "VERIFIED"
      return {
        triggered,
        details: {
          verificationStatus: claim.hospital.verificationStatus,
          required: "VERIFIED",
        },
      }
    }

    case "R-002": {
      const hospitalServiceCodes = claim.hospital.services.map(
        (s) => s.service.code
      )
      const missingServices = claim.items
        .map((i) => i.serviceCode)
        .filter((code) => !hospitalServiceCodes.includes(code))
      const triggered = missingServices.length > 0
      return {
        triggered,
        details: {
          missingServices,
          hospitalServices: hospitalServiceCodes,
        },
      }
    }

    case "R-003": {
      const lookbackDays = parseInt(params.lookbackDays || "5", 10)
      const cutoff = new Date(claim.submittedAt)
      cutoff.setDate(cutoff.getDate() - lookbackDays)

      const serviceIds = claim.items.map((i) => i.serviceId)

      const duplicates = await db.claim.findMany({
        where: {
          hospitalId: claim.hospitalId,
          patientId: claim.patientId,
          id: { not: claim.claimId },
          status: { notIn: ["DRAFT"] },
          submittedAt: { gte: cutoff },
          items: { some: { serviceId: { in: serviceIds } } },
        },
        include: {
          items: { select: { serviceId: true, service: { select: { code: true } }, totalAmountCents: true } },
        },
      })

      const matchedClaims = duplicates.map((d) => ({
        claimId: d.id,
        reference: d.reference,
        submittedAt: d.submittedAt,
        services: d.items.map((i) => i.service.code),
        totalAmountCents: d.totalAmountCents,
      }))

      return {
        triggered: duplicates.length > 0,
        details: {
          lookbackDays,
          cutoffDate: cutoff.toISOString(),
          duplicateCount: duplicates.length,
          matchedClaims,
        },
      }
    }

    case "R-004": {
      const threshold = parseInt(params.thresholdCents || "75000000", 10)
      const triggered = claim.totalAmountCents > threshold
      return {
        triggered,
        details: {
          claimAmount: claim.totalAmountCents,
          threshold,
          thresholdKES: Math.round(threshold / 100).toLocaleString(),
        },
      }
    }

    case "R-005": {
      const maxQty = parseInt(params.maxQuantity || "10", 10)
      const unusualItems = claim.items.filter((i) => i.quantity > maxQty)
      const triggered = unusualItems.length > 0
      return {
        triggered,
        details: {
          maxQuantity: maxQty,
          unusualItems: unusualItems.map((i) => ({
            serviceCode: i.serviceCode,
            quantity: i.quantity,
          })),
        },
      }
    }

    case "R-006": {
      return { triggered: false, details: { note: "Diagnosis matching requires clinical data" } }
    }

    case "R-007": {
      const lookbackDays = parseInt(params.lookbackDays || "7", 10)
      const cutoff = new Date(claim.submittedAt)
      cutoff.setDate(cutoff.getDate() - lookbackDays)

      // Use patientId if available, otherwise use patientReference for lookup
      const patientIdentifier = claim.patientId
      const usePatientReference = !patientIdentifier

      if (!patientIdentifier && !claim.patientReference) {
        return { triggered: false, details: { note: "No patient ID or reference — cannot check cross-facility" } }
      }

      const serviceIds = claim.items.map((i) => i.serviceId)

      // Get service-specific frequency constraints
      const frequencyConstraints = await db.serviceFrequencyConstraint.findMany({
        where: {
          serviceId: { in: serviceIds },
          active: true,
        },
      })

      const constraintMap = new Map(
        frequencyConstraints.map((fc) => [fc.serviceId, fc])
      )

      // For each service, use its specific constraint or default lookback
      const serviceSpecificMatches: Array<{
        serviceId: string
        serviceCode: string
        matchedClaims: Array<{
          claimId: string
          reference: string
          hospitalName: string
          facilityIdentifier: string
          submittedAt: Date
          daysBetween: number
        }>
      }> = []

      for (const item of claim.items) {
        const constraint = constraintMap.get(item.serviceId)
        const serviceLookbackDays = constraint?.minDaysBetweenClaims || lookbackDays
        const serviceCutoff = new Date(claim.submittedAt)
        serviceCutoff.setDate(serviceCutoff.getDate() - serviceLookbackDays)

        // Build where clause based on available patient identifier
        const whereClause: any = {
          hospitalId: { not: claim.hospitalId },
          id: { not: claim.claimId },
          status: { notIn: ["DRAFT"] },
          submittedAt: { not: null, gte: serviceCutoff },
          items: { some: { serviceId: item.serviceId } },
        }

        if (usePatientReference) {
          whereClause.patientReference = claim.patientReference
        } else {
          whereClause.patientId = claim.patientId
        }

        const crossFacilityClaims = await db.claim.findMany({
          where: whereClause,
          include: {
            hospital: { select: { name: true, facilityIdentifier: true } },
          },
        })

        if (crossFacilityClaims.length > 0) {
          serviceSpecificMatches.push({
            serviceId: item.serviceId,
            serviceCode: item.serviceCode,
            matchedClaims: crossFacilityClaims.map((c) => ({
              claimId: c.id,
              reference: c.reference,
              hospitalName: c.hospital.name,
              facilityIdentifier: c.hospital.facilityIdentifier,
              submittedAt: c.submittedAt ?? c.createdAt,
              daysBetween: Math.abs(
                (claim.submittedAt.getTime() -
                  (c.submittedAt ?? c.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              ),
            })),
          })
        }
      }

      // Check max claims per period if configured
      const periodViolations: Array<{
        serviceId: string
        serviceCode: string
        maxClaims: number
        periodDays: number
        actualClaims: number
      }> = []

      for (const [serviceId, constraint] of constraintMap) {
        if (constraint.maxClaimsPerPeriod && constraint.periodDays) {
          const periodCutoff = new Date(claim.submittedAt)
          periodCutoff.setDate(periodCutoff.getDate() - constraint.periodDays)

          const periodWhereClause: any = {
            hospitalId: { not: claim.hospitalId },
            id: { not: claim.claimId },
            status: { notIn: ["DRAFT"] },
            submittedAt: { gte: periodCutoff },
            items: { some: { serviceId } },
          }

          if (usePatientReference) {
            periodWhereClause.patientReference = claim.patientReference
          } else {
            periodWhereClause.patientId = claim.patientId
          }

          const claimsInPeriod = await db.claim.count({
            where: periodWhereClause,
          })

          if (claimsInPeriod >= constraint.maxClaimsPerPeriod) {
            const serviceCode = claim.items.find((i) => i.serviceId === serviceId)?.serviceCode || "UNKNOWN"
            periodViolations.push({
              serviceId,
              serviceCode,
              maxClaims: constraint.maxClaimsPerPeriod,
              periodDays: constraint.periodDays,
              actualClaims: claimsInPeriod,
            })
          }
        }
      }

      const triggered = serviceSpecificMatches.length > 0 || periodViolations.length > 0

      return {
        triggered,
        details: {
          lookbackDays,
          cutoffDate: cutoff.toISOString(),
          patientIdentifier: usePatientReference ? claim.patientReference : claim.patientId,
          identifierType: usePatientReference ? "patientReference" : "patientId",
          serviceSpecificMatches,
          periodViolations,
          totalMatchedServices: serviceSpecificMatches.length,
          totalPeriodViolations: periodViolations.length,
        },
      }
    }

    default:
      return { triggered: false, details: { note: `Unknown rule: ${ruleCode}` } }
  }
}
