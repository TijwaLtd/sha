"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { processClaimPipeline } from "@/lib/rules/orchestrator"

interface ProcessClaimInput {
  claimId: string
}

export async function processClaim(input: ProcessClaimInput) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: input.claimId },
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

  if (claim.status !== "RECEIVED" && claim.status !== "SUBMITTED") {
    return {
      success: false,
      error: `Cannot process claim in status: ${claim.status}`,
    }
  }

  const result = await processClaimPipeline(input.claimId, user.id)

  revalidatePath(`/sha/claims/${input.claimId}`)
  revalidatePath("/sha/claims")
  revalidatePath("/sha/alerts")
  revalidatePath("/sha")
  revalidatePath(`/hospital/claims/${input.claimId}`)
  revalidatePath("/hospital/claims")

  return {
    success: result.success,
    newStatus: result.newStatus,
    riskScore: result.riskScore,
    riskLevel: result.riskLevel,
    aiAnalysisOk: result.aiAnalysisOk,
    contextualRulesTriggered: result.contextualRulesTriggered,
  }
}
