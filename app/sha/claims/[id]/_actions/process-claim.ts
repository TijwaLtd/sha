"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { evaluateClaimRules } from "@/lib/rules/engine"
import { analyzeClaim } from "@/lib/ai/claim-analyzer"
import { calculateRiskScore } from "@/lib/risk/calculator"
import { generateAlerts } from "@/lib/alerts/generator"

interface ProcessClaimInput {
  claimId: string
}

const nextStatus: Record<string, string> = {
  RECEIVED: "VALIDATING",
  VALIDATING: "ANALYZING",
  ANALYZING: "ASSESSED",
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

  if (claim.status === "CLEARED" || claim.status === "FLAGGED" || claim.status === "UNDER_REVIEW") {
    return { success: false, error: "Claim already completed processing" }
  }

  const next = nextStatus[claim.status]
  if (!next) {
    return { success: false, error: `Cannot advance from status: ${claim.status}` }
  }

  await db.claim.update({
    where: { id: input.claimId },
    data: { status: next as "VALIDATING" | "ANALYZING" | "ASSESSED" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLAIM_STATUS_CHANGED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: {
        previousStatus: claim.status,
        newStatus: next,
      },
    },
  })

  if (next === "VALIDATING") {
    await evaluateClaimRules(input.claimId)

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "RULES_EVALUATED",
        entityType: "Claim",
        entityId: input.claimId,
      },
    })
  }

  if (next === "ANALYZING") {
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
  }

  if (next === "ASSESSED") {
    const { totalScore, level } = await calculateRiskScore(input.claimId)

    const shouldFlag = totalScore >= 30 || level === "HIGH" || level === "CRITICAL"
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
        },
      },
    })

    if (shouldFlag) {
      await generateAlerts(input.claimId)

      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "ALERTS_GENERATED",
          entityType: "Claim",
          entityId: input.claimId,
        },
      })
    }

    revalidatePath(`/sha/claims/${input.claimId}`)
    revalidatePath("/sha/claims")
    revalidatePath("/sha/alerts")
    revalidatePath("/sha")
    revalidatePath(`/hospital/claims/${input.claimId}`)
    revalidatePath("/hospital/claims")

    return { success: true, newStatus: finalStatus, riskScore: totalScore, riskLevel: level }
  }

  revalidatePath(`/sha/claims/${input.claimId}`)
  revalidatePath("/sha/claims")

  return { success: true, newStatus: next }
}
