import { createDbClient } from "@/lib/db"
import type { RiskLevel } from "@/app/generated/prisma/enums"

export async function calculateRiskScore(claimId: string) {
  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      findings: true,
      ruleEvaluations: { where: { triggered: true }, include: { complianceRule: true } },
    },
  })

  if (!claim) throw new Error("Claim not found")

  const contributors: Array<{
    type: string
    description: string
    scoreImpact: number
  }> = []

  let totalScore = 0

  for (const eval_ of claim.ruleEvaluations) {
    const scoreImpact = eval_.scoreContribution
    contributors.push({
      type: "RULE",
      description: `Rule ${eval_.complianceRule.code} triggered with impact ${scoreImpact}`,
      scoreImpact,
    })
    totalScore += scoreImpact
  }

  for (const finding of claim.findings) {
    if (finding.source === "AI") {
      const aiScore = calculateAiFindingScore(finding.severity, finding.scoreContribution)
      contributors.push({
        type: "AI",
        description: `AI finding: ${finding.explanation}`,
        scoreImpact: aiScore,
      })
      totalScore += aiScore
    }
  }

  if (claim.totalAmountCents > 500000) {
    const amountScore = Math.min(20, Math.floor(claim.totalAmountCents / 500000) * 10)
    contributors.push({
      type: "SYSTEM",
      description: `High claim amount: KES ${(claim.totalAmountCents / 100).toFixed(0)}`,
      scoreImpact: amountScore,
    })
    totalScore += amountScore
  }

  totalScore = Math.min(totalScore, 100)

  const level: RiskLevel =
    totalScore >= 75
      ? "CRITICAL"
      : totalScore >= 50
        ? "HIGH"
        : totalScore >= 25
          ? "MODERATE"
          : "LOW"

  const existing = await db.riskScore.findUnique({
    where: { claimId },
  })

  let riskScore
  if (existing) {
    riskScore = await db.riskScore.update({
      where: { claimId },
      data: {
        score: totalScore,
        level,
        calculatedAt: new Date(),
      },
    })

    await db.riskContributor.deleteMany({
      where: { riskScoreId: existing.id },
    })
  } else {
    riskScore = await db.riskScore.create({
      data: {
        claimId,
        score: totalScore,
        level,
      },
    })
  }

  for (const contributor of contributors) {
    await db.riskContributor.create({
      data: {
        riskScoreId: riskScore.id,
        type: contributor.type,
        description: contributor.description,
        scoreImpact: contributor.scoreImpact,
      },
    })
  }

  return { riskScore, contributors, totalScore, level }
}

function calculateAiFindingScore(
  severity: string,
  scoreContribution: number
): number {
  const baseScore =
    severity === "CRITICAL"
      ? 25
      : severity === "HIGH"
        ? 15
        : severity === "MEDIUM"
          ? 10
          : 5
  return Math.round(baseScore * (scoreContribution / 10))
}
