import { createDbClient } from "@/lib/db"
import type { ClaimContext } from "./schemas"

export async function analyzeClaim(claimId: string) {
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
      ruleEvaluations: {
        where: { triggered: true },
        include: { complianceRule: true },
      },
    },
  })

  if (!claim) throw new Error("Claim not found")

  const existingAnalysis = await db.aiAnalysis.findFirst({
    where: { claimId, status: "COMPLETED" },
  })
  if (existingAnalysis) {
    return { analysis: existingAnalysis, skipped: true }
  }

  const previousClaims = await db.claim.count({
    where: {
      hospitalId: claim.hospitalId,
      status: { notIn: ["DRAFT"] },
      createdAt: { lt: claim.createdAt },
    },
  })

  const context: ClaimContext = {
    claimId: claim.id,
    reference: claim.reference,
    hospitalName: claim.hospital.name,
    hospitalStatus: claim.hospital.status,
    verificationStatus: claim.hospital.verificationStatus,
    diagnosis: claim.diagnosis,
    totalAmountCents: claim.totalAmountCents,
    items: claim.items.map((item) => ({
      description: item.description ?? "",
      quantity: item.quantity,
      unitPriceCents: item.unitAmountCents,
      serviceCode: item.service.code,
    })),
    hospitalServices: claim.hospital.services.map((s) => s.service.code),
    previousClaims,
    complianceRuleHits: claim.ruleEvaluations.map((eval_) => ({
      ruleCode: eval_.complianceRule.code,
      ruleName: eval_.complianceRule.name,
      triggered: eval_.triggered,
      severity: eval_.complianceRule.severity,
    })),
  }

  const { getAiProvider } = await import("./provider")
  const provider = getAiProvider()
  const response = await provider.analyzeClaim(context)

  const analysis = await db.aiAnalysis.create({
    data: {
      claimId,
      provider: provider.name,
      model: "default",
      promptVersion: "1.0",
      confidence: response.confidence,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structuredResponse: response as any,
      rawOutput: JSON.stringify(response),
      status: "COMPLETED",
    },
  })

  for (const finding of response.findings) {
    await db.aiFinding.create({
      data: {
        aiAnalysisId: analysis.id,
        claimId,
        type: finding.category,
        severity: finding.severity,
        confidence: finding.confidence,
        explanation: finding.description,
      },
    })

    await db.finding.create({
      data: {
        claimId,
        source: "AI",
        type: finding.category,
        title: finding.description.slice(0, 100),
        severity: finding.severity,
        explanation: finding.description,
        evidence: { aiAnalysisId: analysis.id, reasoning: finding.reasoning },
        scoreContribution: Math.round(finding.confidence * 10),
      },
    })
  }

  return { analysis, response }
}
