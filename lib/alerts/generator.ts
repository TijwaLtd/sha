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

const CONTEXTUAL_RULE_ALERT_MAP: Record<
  string,
  { type: AlertType; titleFn: (ref: string, hospital: string) => string; descFn: (ref: string, hospital: string, explanation: string) => string }
> = {
  R_007: {
    type: "EQUIPMENT_UNAVAILABLE",
    titleFn: (_ref, hospital) => `Equipment unavailable: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: required equipment not available. ${exp}`,
  },
  R_008: {
    type: "EQUIPMENT_CAPACITY_EXCEEDED",
    titleFn: (_ref, hospital) => `Equipment capacity exceeded: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: claimed quantity exceeds operational equipment count. ${exp}`,
  },
  R_009: {
    type: "SERVICE_CAPACITY_EXCEEDED",
    titleFn: (_ref, hospital) => `Service capacity exceeded: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: service capacity limit exceeded. ${exp}`,
  },
  R_010: {
    type: "TARIFF_EXCEEDED",
    titleFn: (_ref, hospital) => `Tariff exceeded: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: billed amount exceeds configured tariff. ${exp}`,
  },
  R_011: {
    type: "SERVICE_NOT_ACCREDITED",
    titleFn: (_ref, hospital) => `Service not accredited: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: facility not accredited for the claimed service. ${exp}`,
  },
  R_012: {
    type: "PATIENT_SERVICE_FREQUENCY_ANOMALY",
    titleFn: (_ref, _hospital) => `Patient service frequency anomaly`,
    descFn: (ref, _hospital, exp) =>
      `Claim ${ref}: patient service frequency exceeds expected pattern. ${exp}`,
  },
  R_013: {
    type: "PATIENT_SPENDING_ANOMALY",
    titleFn: (_ref, _hospital) => `Patient spending anomaly`,
    descFn: (ref, _hospital, exp) =>
      `Claim ${ref}: patient cumulative spending exceeds threshold. ${exp}`,
  },
  R_014: {
    type: "DAILY_BILLING_LIMIT_EXCEEDED",
    titleFn: (_ref, hospital) => `Daily billing limit exceeded: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: daily billing total exceeds policy limit. ${exp}`,
  },
  R_015: {
    type: "MONTHLY_BILLING_LIMIT_EXCEEDED",
    titleFn: (_ref, hospital) => `Monthly billing limit exceeded: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: monthly billing total exceeds policy limit. ${exp}`,
  },
  R_016: {
    type: "FACILITY_SCOPE_BREACH",
    titleFn: (_ref, hospital) => `Facility scope breach: ${hospital}`,
    descFn: (ref, hospital, exp) =>
      `Claim ${ref} from ${hospital}: service not allowed for this facility level. ${exp}`,
  },
}

const RULE_TO_ALERT_TYPE: Record<string, AlertType> = {
  "R-003": "DUPLICATE_CLAIM",
  "R-007": "CROSS_FACILITY_ANOMALY",
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

  for (const eval_ of claim.ruleEvaluations) {
    const code = eval_.complianceRule.code

    if (code === "R-002") {
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
          details: eval_.explanation,
        },
      })
    }

    const ruleAlertType = RULE_TO_ALERT_TYPE[code]
    if (ruleAlertType) {
      const existingAlert = alerts.find(
        (a) => a.type === ruleAlertType && a.claimId === claimId
      )
      if (!existingAlert) {
        alerts.push({
          type: ruleAlertType,
          severity: eval_.scoreContribution >= 30 ? "CRITICAL" : "HIGH",
          title: `${ruleAlertType.replace(/_/g, " ").toLowerCase()}: ${claim.reference}`,
          description: `Claim ${claim.reference}: rule ${code} triggered with score ${eval_.scoreContribution}.`,
          claimId,
          hospitalId: claim.hospitalId,
          source: "RULE",
          metadata: {
            ruleCode: code,
            scoreContribution: eval_.scoreContribution,
            explanation: eval_.explanation,
          },
        })
      }
    }
  }

  for (const eval_ of claim.ruleEvaluations) {
    const code = eval_.complianceRule.code.replace("-", "_")
    const mapping = CONTEXTUAL_RULE_ALERT_MAP[code]
    if (!mapping) continue

    const existing = alerts.find(
      (a) => a.type === mapping.type && a.claimId === claimId
    )
    if (existing) continue

    let explanation = ""
    try {
      const parsed = JSON.parse(eval_.explanation ?? "{}")
      if (Array.isArray(parsed)) {
        explanation = parsed.map((s: { explanation?: string }) => s.explanation).join("; ")
      } else if (parsed.note) {
        explanation = parsed.note
      }
    } catch {
      explanation = eval_.explanation ?? ""
    }

    alerts.push({
      type: mapping.type,
      severity: eval_.scoreContribution >= 25 ? "HIGH" : "MEDIUM",
      title: mapping.titleFn(claim.reference, claim.hospital.name),
      description: mapping.descFn(claim.reference, claim.hospital.name, explanation),
      claimId,
      hospitalId: claim.hospitalId,
      source: "RULE",
      metadata: {
        ruleCode: eval_.complianceRule.code,
        scoreContribution: eval_.scoreContribution,
        explanation,
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
