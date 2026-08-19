import { createDbClient } from "@/lib/db"
import type { AlertType, FindingSeverity } from "@/app/generated/prisma/enums"

interface AlertInput {
  type: AlertType
  severity: FindingSeverity
  title: string
  description: string
  claimId?: string
  hospitalId?: string
  riskScoreId?: string
  source: "RULE" | "AI" | "SYSTEM" | "REVIEW"
  metadata?: Record<string, unknown>
}

export async function generateAlerts(claimId: string) {
  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: {
      hospital: true,
      findings: true,
      riskScore: { include: { contributors: true } },
      ruleEvaluations: {
        where: { triggered: true },
        include: { complianceRule: true },
      },
    },
  })

  if (!claim) throw new Error("Claim not found")

  const alerts: AlertInput[] = []

  if (claim.riskScore && claim.riskScore.level === "CRITICAL") {
    alerts.push({
      type: "HIGH_RISK_CLAIM",
      severity: "CRITICAL",
      title: `Critical risk claim: ${claim.reference}`,
      description: `Claim ${claim.reference} from ${claim.hospital.name} has a critical risk score of ${claim.riskScore.score}. Immediate review required.`,
      claimId,
      hospitalId: claim.hospitalId,
      riskScoreId: claim.riskScore.id,
      source: "SYSTEM",
      metadata: {
        riskScore: claim.riskScore.score,
        riskLevel: claim.riskScore.level,
      },
    })
  } else if (claim.riskScore && claim.riskScore.level === "HIGH") {
    alerts.push({
      type: "HIGH_RISK_CLAIM",
      severity: "HIGH",
      title: `High risk claim: ${claim.reference}`,
      description: `Claim ${claim.reference} from ${claim.hospital.name} has a high risk score of ${claim.riskScore.score}.`,
      claimId,
      hospitalId: claim.hospitalId,
      riskScoreId: claim.riskScore.id,
      source: "SYSTEM",
      metadata: {
        riskScore: claim.riskScore.score,
        riskLevel: claim.riskScore.level,
      },
    })
  }

  if (claim.hospital.verificationStatus !== "VERIFIED") {
    alerts.push({
      type: "FACILITY_VERIFICATION",
      severity: "HIGH",
      title: `Unverified facility: ${claim.hospital.name}`,
      description: `Claim ${claim.reference} submitted by unverified facility ${claim.hospital.name} (${claim.hospital.verificationStatus}).`,
      claimId,
      hospitalId: claim.hospitalId,
      source: "RULE",
      metadata: {
        verificationStatus: claim.hospital.verificationStatus,
      },
    })
  }

  const serviceMismatch = claim.ruleEvaluations.find(
    (e) => e.complianceRule.code === "R-002" && e.triggered
  )
  if (serviceMismatch) {
    alerts.push({
      type: "SERVICE_MISMATCH",
      severity: "HIGH",
      title: `Service mismatch: ${claim.reference}`,
      description: `Claim ${claim.reference} includes services not authorized for ${claim.hospital.name}.`,
      claimId,
      hospitalId: claim.hospitalId,
      source: "RULE",
      metadata: {
        ruleCode: "R-002",
        details: serviceMismatch.explanation,
      },
    })
  }

  const ruleCoveredTypes = new Set<string>()
  for (const alert of alerts) {
    if (alert.type === "FACILITY_VERIFICATION") ruleCoveredTypes.add("FACILITY_CONCERN")
    if (alert.type === "SERVICE_MISMATCH") ruleCoveredTypes.add("SERVICE_MISMATCH")
    if (alert.type === "HIGH_RISK_CLAIM") {
      ruleCoveredTypes.add("AMOUNT_ANOMALY")
      ruleCoveredTypes.add("QUANTITY_ANOMALY")
    }
  }

  const aiFindings = claim.findings.filter((f) => f.source === "AI")
  for (const finding of aiFindings) {
    if (finding.severity !== "HIGH" && finding.severity !== "CRITICAL") continue
    if (ruleCoveredTypes.has(finding.type || "")) continue

    alerts.push({
      type: "AI_REVIEW_REQUIRED",
      severity: finding.severity as "HIGH" | "CRITICAL",
      title: `AI finding: ${finding.type || "Unknown"}`,
      description: `AI analysis identified ${finding.severity.toLowerCase()} severity concern: ${finding.explanation}`,
      claimId,
      hospitalId: claim.hospitalId,
      source: "AI",
      metadata: {
        findingType: finding.type,
        confidence: finding.scoreContribution,
      },
    })
  }

  const createdAlerts = []
  for (const alertInput of alerts) {
    const existing = await db.alert.findFirst({
      where: {
        type: alertInput.type,
        claimId: alertInput.claimId,
        status: { in: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW"] },
      },
    })

    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metadata = alertInput.metadata as any

      const alert = await db.alert.create({
        data: {
          type: alertInput.type,
          severity: alertInput.severity,
          title: alertInput.title,
          description: alertInput.description,
          claimId: alertInput.claimId,
          hospitalId: alertInput.hospitalId,
          riskScoreId: alertInput.riskScoreId,
          source: alertInput.source,
          metadata,
        },
      })
      createdAlerts.push(alert)
    }
  }

  return createdAlerts
}

export async function createAlert(input: AlertInput) {
  const db = createDbClient()

  const existing = await db.alert.findFirst({
    where: {
      type: input.type,
      claimId: input.claimId,
      status: { in: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW"] },
    },
  })

  if (existing) return existing

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata = input.metadata as any

  return db.alert.create({
    data: {
      type: input.type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      claimId: input.claimId,
      hospitalId: input.hospitalId,
      riskScoreId: input.riskScoreId,
      source: input.source,
      metadata,
    },
  })
}
