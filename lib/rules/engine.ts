import { createDbClient } from "@/lib/db"

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
    const result = evaluateRule(rule.code, {
      hospital: claim.hospital,
      items: claim.items.map((item) => ({
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

function evaluateRule(
  ruleCode: string,
  claim: {
    hospital: {
      status: string
      verificationStatus: string
      services: Array<{ service: { code: string } }>
    }
    items: Array<{ serviceCode: string; quantity: number; unitPriceCents: number }>
    totalAmountCents: number
  }
): { triggered: boolean; details: Record<string, unknown> } {
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
      return { triggered: false, details: { note: "Duplicate detection requires claim history analysis" } }
    }

    case "R-004": {
      const avgAmount = 250000
      const threshold = avgAmount * 3
      const triggered = claim.totalAmountCents > threshold
      return {
        triggered,
        details: {
          claimAmount: claim.totalAmountCents,
          averageAmount: avgAmount,
          threshold,
        },
      }
    }

    case "R-005": {
      const unusualItems = claim.items.filter((i) => i.quantity > 10)
      const triggered = unusualItems.length > 0
      return {
        triggered,
        details: {
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

    default:
      return { triggered: false, details: { note: `Unknown rule: ${ruleCode}` } }
  }
}
