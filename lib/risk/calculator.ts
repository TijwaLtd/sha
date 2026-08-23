import { createDbClient } from "@/lib/db"
import type { RiskLevel } from "@/app/generated/prisma/enums"

const CRITICAL_RULE_CODES = new Set(["R-001", "R-002", "R-007"])

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
  let hasCriticalRule = false

  for (const eval_ of claim.ruleEvaluations) {
    const scoreImpact = eval_.scoreContribution
    const code = eval_.complianceRule.code

    if (CRITICAL_RULE_CODES.has(code) && scoreImpact >= 30) {
      hasCriticalRule = true
    }

    contributors.push({
      type: "RULE",
      description: `Rule ${code} triggered with impact ${scoreImpact}`,
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

  if (claim.ruleEvaluations.length > 1) {
    const multiRuleBonus = Math.min(claim.ruleEvaluations.length * 2, 10)
    contributors.push({
      type: "AGGREGATE",
      description: `Multi-rule aggregate: ${claim.ruleEvaluations.length} rules triggered`,
      scoreImpact: multiRuleBonus,
    })
    totalScore += multiRuleBonus
  }

  totalScore = Math.min(totalScore, 100)

  let level: RiskLevel
  if (hasCriticalRule) {
    level = "CRITICAL"
  } else if (totalScore >= 75) {
    level = "CRITICAL"
  } else if (totalScore >= 50) {
    level = "HIGH"
  } else if (totalScore >= 25) {
    level = "MODERATE"
  } else {
    level = "LOW"
  }

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
