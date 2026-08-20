import { createDbClient } from "@/lib/db"
import { evaluateClaimRules } from "@/lib/rules/engine"
import { evaluateContextualRules } from "@/lib/rules/contextual"
import { calculateRiskScore } from "@/lib/risk/calculator"
import { generateAlerts } from "@/lib/alerts/generator"

export interface ProcessingResult {
  ruleEvaluations: Awaited<ReturnType<typeof evaluateClaimRules>>
  contextualResults: Awaited<ReturnType<typeof evaluateContextualRules>>
  riskScore: Awaited<ReturnType<typeof calculateRiskScore>>
  alerts: Awaited<ReturnType<typeof generateAlerts>>
}

export async function processClaimPipeline(claimId: string): Promise<ProcessingResult> {
  const db = createDbClient()

  const claim = await db.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error("Claim not found")

  await db.claim.update({
    where: { id: claimId },
    data: { status: "VALIDATING" },
  })

  await db.auditLog.create({
    data: {
      action: "CLAIM_PROCESSING_STARTED",
      entityType: "Claim",
      entityId: claimId,
      userId: null,
      metadata: { startedAt: new Date().toISOString() },
    },
  })

  const ruleEvaluations = await evaluateClaimRules(claimId)
  const contextualResults = await evaluateContextualRules(claimId)

  await db.claim.update({
    where: { id: claimId },
    data: { status: "ANALYZING" },
  })

  await db.claim.update({
    where: { id: claimId },
    data: { status: "ASSESSED" },
  })

  const riskScore = await calculateRiskScore(claimId)
  const alerts = await generateAlerts(claimId)

  await db.auditLog.create({
    data: {
      action: "CLAIM_PROCESSING_COMPLETED",
      entityType: "Claim",
      entityId: claimId,
      userId: null,
      metadata: {
        riskScore: riskScore.totalScore,
        riskLevel: riskScore.level,
        alertsGenerated: alerts.length,
        completedAt: new Date().toISOString(),
      },
    },
  })

  return {
    ruleEvaluations,
    contextualResults,
    riskScore,
    alerts,
  }
}
