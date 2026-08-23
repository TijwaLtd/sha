import { createDbClient } from "@/lib/db"
import { evaluateCapabilitySignals } from "@/lib/capability/service"
import { evaluateEquipmentSignals } from "@/lib/equipment/service"
import { evaluateTariffSignals } from "@/lib/tariff/service"
import { evaluatePatientSignals } from "@/lib/patient/service"
import { evaluateCapacitySignals } from "@/lib/capacity/service"
import { evaluateBillingSignals } from "@/lib/billing/service"

export interface ContextualRuleResult {
  ruleCode: string
  triggered: boolean
  scoreImpact: number
  signals: Array<{
    signal: string
    severity: string
    expected: unknown
    observed: unknown
    explanation: string
  }>
}

const RULE_SCORES: Record<string, number> = {
  R_007: 20,
  R_008: 15,
  R_009: 20,
  R_010: 15,
  R_011: 25,
  R_012: 20,
  R_013: 15,
  R_014: 20,
  R_015: 15,
  R_016: 10,
}

export async function evaluateContextualRules(
  claimId: string
): Promise<ContextualRuleResult[]> {
  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      hospital: {
        include: { facilityLevel: true },
      },
      items: { include: { service: true } },
      patient: true,
    },
  })

  if (!claim) throw new Error("Claim not found")

  const claimDate = claim.submittedAt ?? new Date()
  const results: ContextualRuleResult[] = []

  for (const item of claim.items) {
    try {
      const capabilitySignals = await evaluateCapabilitySignals(
        claim.hospitalId,
        item.service.code,
        claimDate
      )
      if (capabilitySignals.length > 0) {
        const triggered = capabilitySignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")
        results.push({
          ruleCode: "R_011",
          triggered,
          scoreImpact: triggered ? RULE_SCORES["R_011"] : 0,
          signals: capabilitySignals,
        })
      }
    } catch (e) {
      console.error("Capability signals failed for item", item.service.code, e)
    }

    try {
      const equipmentSignals = await evaluateEquipmentSignals(
        claim.hospitalId,
        item.serviceId,
        item.quantity,
        claimDate
      )
      if (equipmentSignals.length > 0) {
        const hasHighSeverity = equipmentSignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")
        results.push({
          ruleCode: "R_007",
          triggered: hasHighSeverity,
          scoreImpact: hasHighSeverity ? RULE_SCORES["R_007"] : 0,
          signals: equipmentSignals,
        })

        const capacityExceeded = equipmentSignals.some(s => s.signal === "EQUIPMENT_CAPACITY_EXCEEDED")
        if (capacityExceeded) {
          results.push({
            ruleCode: "R_008",
            triggered: true,
            scoreImpact: RULE_SCORES["R_008"],
            signals: equipmentSignals.filter(s => s.signal === "EQUIPMENT_CAPACITY_EXCEEDED"),
          })
        }
      }
    } catch (e) {
      console.error("Equipment signals failed for item", item.service.code, e)
    }

    try {
      const tariffSignals = await evaluateTariffSignals(
        item.serviceId,
        claim.hospital.facilityLevelId,
        claim.hospitalId,
        item.unitAmountCents,
        item.quantity,
        claimDate
      )
      if (tariffSignals.length > 0) {
        const triggered = tariffSignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")
        results.push({
          ruleCode: "R_010",
          triggered,
          scoreImpact: triggered ? RULE_SCORES["R_010"] : 0,
          signals: tariffSignals,
        })
      }
    } catch (e) {
      console.error("Tariff signals failed for item", item.service.code, e)
    }

    try {
      const capacitySignals = await evaluateCapacitySignals(
        claim.hospitalId,
        item.serviceId,
        item.quantity,
        claimDate
      )
      if (capacitySignals.length > 0) {
        const triggered = capacitySignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")
        results.push({
          ruleCode: "R_009",
          triggered,
          scoreImpact: triggered ? RULE_SCORES["R_009"] : 0,
          signals: capacitySignals,
        })
      }
    } catch (e) {
      console.error("Capacity signals failed for item", item.service.code, e)
    }

    try {
      const billingSignals = await evaluateBillingSignals(
        claim.hospitalId,
        claim.hospital.facilityLevelId,
        item.serviceId,
        item.totalAmountCents,
        item.quantity,
        claimDate
      )
      if (billingSignals.length > 0) {
        const dailySignals = billingSignals.filter(s => s.signal === "DAILY_BILLING_LIMIT_EXCEEDED")
        if (dailySignals.length > 0) {
          results.push({
            ruleCode: "R_014",
            triggered: true,
            scoreImpact: RULE_SCORES["R_014"],
            signals: dailySignals,
          })
        }

        const monthlySignals = billingSignals.filter(s => s.signal === "MONTHLY_BILLING_LIMIT_EXCEEDED")
        if (monthlySignals.length > 0) {
          results.push({
            ruleCode: "R_015",
            triggered: true,
            scoreImpact: RULE_SCORES["R_015"],
            signals: monthlySignals,
          })
        }

        const encounterSignals = billingSignals.filter(s => s.signal === "ENCOUNTER_BILLING_LIMIT_EXCEEDED")
        if (encounterSignals.length > 0) {
          results.push({
            ruleCode: "R_010",
            triggered: true,
            scoreImpact: RULE_SCORES["R_010"],
            signals: encounterSignals,
          })
        }
      }
    } catch (e) {
      console.error("Billing signals failed for item", item.service.code, e)
    }
  }

  if (claim.patientId) {
    const allFrequencySignals: ContextualRuleResult["signals"] = []
    const allSpendingSignals: ContextualRuleResult["signals"] = []

    for (const item of claim.items) {
      const patientSignals = await evaluatePatientSignals(
        claim.patientId,
        item.service.code,
        item.totalAmountCents,
        claimDate
      )

      for (const sig of patientSignals) {
        if (sig.signal === "PATIENT_SERVICE_FREQUENCY_ANOMALY") {
          const exists = allFrequencySignals.some(
            (s) => s.explanation === sig.explanation
          )
          if (!exists) allFrequencySignals.push(sig)
        }
        if (sig.signal === "PATIENT_SPENDING_ANOMALY") {
          const exists = allSpendingSignals.some(
            (s) => s.explanation === sig.explanation
          )
          if (!exists) allSpendingSignals.push(sig)
        }
      }
    }

    if (allFrequencySignals.length > 0) {
      results.push({
        ruleCode: "R_012",
        triggered: true,
        scoreImpact: RULE_SCORES["R_012"],
        signals: allFrequencySignals,
      })
    }

    if (allSpendingSignals.length > 0) {
      results.push({
        ruleCode: "R_013",
        triggered: true,
        scoreImpact: RULE_SCORES["R_013"],
        signals: allSpendingSignals,
      })
    }
  }

  const deduplicated = deduplicateResults(results)

  const ruleCodeToHyphen = (code: string) => code.replace("_", "-")
  const ruleCodes = [...new Set(deduplicated.map(r => r.ruleCode))]
  const rules = await db.complianceRule.findMany({
    where: { code: { in: ruleCodes.map(ruleCodeToHyphen) } },
  })
  const ruleMap = new Map(rules.map(r => [r.code.replace("-", "_"), r.id]))

  for (const result of deduplicated) {
    const ruleId = ruleMap.get(result.ruleCode)
    if (!ruleId) continue

    await db.claimRuleEvaluation.upsert({
      where: {
        claimId_complianceRuleId: {
          claimId,
          complianceRuleId: ruleId,
        },
      },
      update: {
        triggered: result.triggered,
        scoreContribution: result.triggered ? result.scoreImpact : 0,
        explanation: JSON.stringify(result.signals),
      },
      create: {
        claimId,
        complianceRuleId: ruleId,
        triggered: result.triggered,
        scoreContribution: result.triggered ? result.scoreImpact : 0,
        explanation: JSON.stringify(result.signals),
      },
    })
  }

  return deduplicated
}

const SEVERITY_RANK: Record<string, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

function deduplicateResults(
  results: ContextualRuleResult[]
): ContextualRuleResult[] {
  const byCode = new Map<string, ContextualRuleResult[]>()
  for (const r of results) {
    const existing = byCode.get(r.ruleCode) ?? []
    existing.push(r)
    byCode.set(r.ruleCode, existing)
  }

  const out: ContextualRuleResult[] = []
  for (const [, group] of byCode) {
    const best = group.reduce((a, b) => {
      const aMax = Math.max(
        ...a.signals.map((s) => SEVERITY_RANK[s.severity] ?? 0)
      )
      const bMax = Math.max(
        ...b.signals.map((s) => SEVERITY_RANK[s.severity] ?? 0)
      )
      return bMax > aMax ? b : a
    })
    out.push(best)
  }
  return out
}
