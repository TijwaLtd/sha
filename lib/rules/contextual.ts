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

    const equipmentSignals = await evaluateEquipmentSignals(
      claim.hospitalId,
      item.serviceId,
      item.quantity,
      claimDate
    )
    if (equipmentSignals.length > 0) {
      const triggered = equipmentSignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")
      results.push({
        ruleCode: "R_007",
        triggered,
        scoreImpact: triggered ? RULE_SCORES["R_007"] : 0,
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

    const billingSignals = await evaluateBillingSignals(
      claim.hospitalId,
      claim.hospital.facilityLevelId,
      item.serviceId,
      item.totalAmountCents,
      item.quantity,
      claimDate
    )
    if (billingSignals.length > 0) {
      const triggered = billingSignals.some(s => s.severity === "HIGH" || s.severity === "CRITICAL")

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
  }

  if (claim.patientId) {
    const patientSignals = await evaluatePatientSignals(
      claim.patientId,
      claim.items[0]?.service.code ?? "",
      claim.totalAmountCents,
      claimDate
    )
    if (patientSignals.length > 0) {
      const frequencySignals = patientSignals.filter(s => s.signal === "PATIENT_SERVICE_FREQUENCY_ANOMALY")
      if (frequencySignals.length > 0) {
        results.push({
          ruleCode: "R_012",
          triggered: true,
          scoreImpact: RULE_SCORES["R_012"],
          signals: frequencySignals,
        })
      }

      const spendingSignals = patientSignals.filter(s => s.signal === "PATIENT_SPENDING_ANOMALY")
      if (spendingSignals.length > 0) {
        results.push({
          ruleCode: "R_013",
          triggered: true,
          scoreImpact: RULE_SCORES["R_013"],
          signals: spendingSignals,
        })
      }
    }
  }

  for (const result of results) {
    await db.claimRuleEvaluation.upsert({
      where: {
        claimId_complianceRuleId: {
          claimId,
          complianceRuleId: result.ruleCode,
        },
      },
      update: {
        triggered: result.triggered,
        scoreContribution: result.triggered ? result.scoreImpact : 0,
        explanation: JSON.stringify(result.signals),
      },
      create: {
        claimId,
        complianceRuleId: result.ruleCode,
        triggered: result.triggered,
        scoreContribution: result.triggered ? result.scoreImpact : 0,
        explanation: JSON.stringify(result.signals),
      },
    })
  }

  return results
}
