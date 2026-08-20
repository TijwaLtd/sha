"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { evaluateClaimRules } from "@/lib/rules/engine"
import { evaluateContextualRules } from "@/lib/rules/contextual"
import { analyzeClaim } from "@/lib/ai/claim-analyzer"
import { calculateRiskScore } from "@/lib/risk/calculator"
import { generateAlerts } from "@/lib/alerts/generator"

interface ProcessClaimInput {
  claimId: string
}

export async function processClaim(input: ProcessClaimInput) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: input.claimId },
    include: {
      hospital: true,
      riskScore: true,
    },
  })

  if (!claim) {
    return { success: false, error: "Claim not found" }
  }

  if (
    claim.status === "CLEARED" ||
    claim.status === "FLAGGED" ||
    claim.status === "UNDER_REVIEW"
  ) {
    return { success: false, error: "Claim already completed processing" }
  }

  if (claim.status !== "RECEIVED") {
    return {
      success: false,
      error: `Cannot process claim in status: ${claim.status}`,
    }
  }

  // ─── Step 1: VALIDATING — Compliance rules ────
  await db.claim.update({
    where: { id: input.claimId },
    data: { status: "VALIDATING" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: { previousStatus: "RECEIVED", newStatus: "VALIDATING" },
    },
  })

  await evaluateClaimRules(input.claimId)

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "RULES_EVALUATED",
      entityType: "Claim",
      entityId: input.claimId,
    },
  })

  // ─── Step 1b: CONTEXTUAL — Equipment, tariff, capacity, billing ────
  const contextualResults = await evaluateContextualRules(input.claimId)

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CONTEXTUAL_RULES_EVALUATED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: {
        rulesEvaluated: contextualResults.length,
        rulesTriggered: contextualResults.filter((r) => r.triggered).length,
      },
    },
  })

  // ─── Step 2: ANALYZING — AI analysis ────
  await db.claim.update({
    where: { id: input.claimId },
    data: { status: "ANALYZING" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: { previousStatus: "VALIDATING", newStatus: "ANALYZING" },
    },
  })

  let aiAnalysisOk = true
  try {
    await analyzeClaim(input.claimId)

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "AI_ANALYSIS_COMPLETED",
        entityType: "Claim",
        entityId: input.claimId,
      },
    })
  } catch (error) {
    aiAnalysisOk = false
    console.error("AI analysis failed:", error)
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "AI_ANALYSIS_FAILED",
        entityType: "Claim",
        entityId: input.claimId,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
    })
  }

  // ─── Step 3: ASSESSED — Risk score ────
  await db.claim.update({
    where: { id: input.claimId },
    data: { status: "ASSESSED" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: { previousStatus: "ANALYZING", newStatus: "ASSESSED" },
    },
  })

  const { totalScore, level } = await calculateRiskScore(input.claimId)

  const shouldFlag = totalScore >= 50 || level === "HIGH" || level === "CRITICAL"
  const finalStatus = shouldFlag ? "FLAGGED" : "CLEARED"

  await db.claim.update({
    where: { id: input.claimId },
    data: { status: finalStatus as "FLAGGED" | "CLEARED" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "RISK_ASSESSED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: {
        riskScore: totalScore,
        riskLevel: level,
        finalStatus,
        aiAnalysisOk,
        contextualRulesTriggered: contextualResults.filter((r) => r.triggered).length,
      },
    },
  })

  await generateAlerts(input.claimId)

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ALERTS_GENERATED",
      entityType: "Claim",
      entityId: input.claimId,
    },
  })

  revalidatePath(`/sha/claims/${input.claimId}`)
  revalidatePath("/sha/claims")
  revalidatePath("/sha/alerts")
  revalidatePath("/sha")
  revalidatePath(`/hospital/claims/${input.claimId}`)
  revalidatePath("/hospital/claims")

  return {
    success: true,
    newStatus: finalStatus,
    riskScore: totalScore,
    riskLevel: level,
    aiAnalysisOk,
    contextualRulesTriggered: contextualResults.filter((r) => r.triggered).length,
  }
}
