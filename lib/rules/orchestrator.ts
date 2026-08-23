import { createDbClient } from "@/lib/db"
import { evaluateClaimRules } from "@/lib/rules/engine"
import { evaluateContextualRules } from "@/lib/rules/contextual"
import { analyzeClaim } from "@/lib/ai/claim-analyzer"
import { calculateRiskScore } from "@/lib/risk/calculator"
import { generateAlerts } from "@/lib/alerts/generator"

export interface ProcessingResult {
  success: boolean
  newStatus: string
  riskScore: number
  riskLevel: string
  aiAnalysisOk: boolean
  contextualRulesTriggered: number
  alertsGenerated: number
  ruleEvaluations: Awaited<ReturnType<typeof evaluateClaimRules>>
  contextualResults: Awaited<ReturnType<typeof evaluateContextualRules>>
}

export async function processClaimPipeline(
  claimId: string,
  userId: string
): Promise<ProcessingResult> {
  const db = createDbClient()

  const claim = await db.claim.findUnique({ where: { id: claimId } })
  if (!claim) throw new Error("Claim not found")

  await db.claim.update({
    where: { id: claimId },
    data: { status: "VALIDATING" },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: claimId,
      metadata: { previousStatus: claim.status, newStatus: "VALIDATING" },
    },
  })

  const ruleEvaluations = await evaluateClaimRules(claimId)

  await db.auditLog.create({
    data: {
      userId,
      action: "RULES_EVALUATED",
      entityType: "Claim",
      entityId: claimId,
    },
  })

  const contextualResults = await evaluateContextualRules(claimId)

  await db.auditLog.create({
    data: {
      userId,
      action: "CONTEXTUAL_RULES_EVALUATED",
      entityType: "Claim",
      entityId: claimId,
      metadata: {
        rulesEvaluated: contextualResults.length,
        rulesTriggered: contextualResults.filter((r) => r.triggered).length,
      },
    },
  })

  await db.claim.update({
    where: { id: claimId },
    data: { status: "ANALYZING" },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: claimId,
      metadata: { previousStatus: "VALIDATING", newStatus: "ANALYZING" },
    },
  })

  let aiAnalysisOk = true
  try {
    await analyzeClaim(claimId)

    await db.auditLog.create({
      data: {
        userId,
        action: "AI_ANALYSIS_COMPLETED",
        entityType: "Claim",
        entityId: claimId,
      },
    })
  } catch (error) {
    aiAnalysisOk = false
    console.error("AI analysis failed:", error)
    await db.auditLog.create({
      data: {
        userId,
        action: "AI_ANALYSIS_FAILED",
        entityType: "Claim",
        entityId: claimId,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    })
  }

  await db.claim.update({
    where: { id: claimId },
    data: { status: "ASSESSED" },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: claimId,
      metadata: { previousStatus: "ANALYZING", newStatus: "ASSESSED" },
    },
  })

  const { totalScore, level } = await calculateRiskScore(claimId)

  const shouldFlag = totalScore >= 50 || level === "HIGH" || level === "CRITICAL"
  const finalStatus = shouldFlag ? "FLAGGED" : "CLEARED"

  await db.claim.update({
    where: { id: claimId },
    data: { status: finalStatus as "FLAGGED" | "CLEARED" },
  })

  await db.auditLog.create({
    data: {
      userId,
      action: "RISK_ASSESSED",
      entityType: "Claim",
      entityId: claimId,
      metadata: {
        riskScore: totalScore,
        riskLevel: level,
        finalStatus,
        aiAnalysisOk,
        contextualRulesTriggered: contextualResults.filter((r) => r.triggered).length,
      },
    },
  })

  const alerts = await generateAlerts(claimId)

  await db.auditLog.create({
    data: {
      userId,
      action: "ALERTS_GENERATED",
      entityType: "Claim",
      entityId: claimId,
    },
  })

  return {
    success: true,
    newStatus: finalStatus,
    riskScore: totalScore,
    riskLevel: level,
    aiAnalysisOk,
    contextualRulesTriggered: contextualResults.filter((r) => r.triggered).length,
    alertsGenerated: alerts.length,
    ruleEvaluations,
    contextualResults,
  }
}
