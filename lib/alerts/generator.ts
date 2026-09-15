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

// Maps a contextual signal name to the alert an officer should see.
// Rule codes for contextual signals are derived from the signal itself, not
// from the rule code a generic map would mislabel.
const SIGNAL_TO_ALERT: Record<string, { type: AlertType; severity: FindingSeverity }> = {
  EQUIPMENT_UNAVAILABLE: { type: "EQUIPMENT_UNAVAILABLE", severity: "HIGH" },
  EQUIPMENT_CAPACITY_EXCEEDED: { type: "EQUIPMENT_CAPACITY_EXCEEDED", severity: "HIGH" },
  SERVICE_CAPACITY_EXCEEDED: { type: "SERVICE_CAPACITY_EXCEEDED", severity: "HIGH" },
  STAFF_CAPACITY_EXCEEDED: { type: "STAFF_CAPACITY_EXCEEDED", severity: "HIGH" },
  TARIFF_EXCEEDED: { type: "TARIFF_EXCEEDED", severity: "MEDIUM" },
  SERVICE_NOT_ACCREDITED: { type: "SERVICE_NOT_ACCREDITED", severity: "HIGH" },
  PATIENT_SERVICE_FREQUENCY_ANOMALY: { type: "PATIENT_SERVICE_FREQUENCY_ANOMALY", severity: "MEDIUM" },
  PATIENT_SPENDING_ANOMALY: { type: "PATIENT_SPENDING_ANOMALY", severity: "MEDIUM" },
  DAILY_BILLING_LIMIT_EXCEEDED: { type: "DAILY_BILLING_LIMIT_EXCEEDED", severity: "HIGH" },
  MONTHLY_BILLING_LIMIT_EXCEEDED: { type: "MONTHLY_BILLING_LIMIT_EXCEEDED", severity: "MEDIUM" },
  ENCOUNTER_BILLING_LIMIT_EXCEEDED: { type: "ENCOUNTER_BILLING_LIMIT_EXCEEDED", severity: "MEDIUM" },
  FACILITY_SCOPE_BREACH: { type: "FACILITY_SCOPE_BREACH", severity: "HIGH" },
}

function humanizeLabel(type: AlertType): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

type Explanation = Record<string, unknown> | unknown[]
interface ServiceMatch {
  serviceId: string
  serviceCode: string
  matchedClaims: Array<{
    claimId: string
    reference: string
    hospitalName: string
    facilityIdentifier: string
    submittedAt: Date
    daysBetween: number
  }>
}
interface PeriodViolation {
  serviceCode: string
  maxClaims: number
  periodDays: number
  actualClaims: number
}
interface Signal {
  signal: string
  severity?: string
  expected?: unknown
  observed?: unknown
  explanation?: string
}

function parseExplanation(explanation: string | null): Explanation {
  try {
    return JSON.parse(explanation ?? "{}") as Explanation
  } catch {
    return {}
  }
}

function hasAlert(alerts: AlertInput[], type: AlertType, claimId: string): boolean {
  return alerts.some((a) => a.type === type && a.claimId === claimId)
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
      const parsed = parseExplanation(eval_.explanation)
      const details =
        parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
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
          missingServices: Array.isArray(details["missingServices"])
            ? details["missingServices"]
            : [],
          hospitalServices: Array.isArray(details["hospitalServices"])
            ? details["hospitalServices"]
            : [],
        },
      })
    }

    if (code === "R-003") {
      if (hasAlert(alerts, "DUPLICATE_CLAIM", claimId)) continue
      const parsed = parseExplanation(eval_.explanation)
      const details =
        parsed && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
      const duplicates = Array.isArray(details["matchedClaims"])
        ? ((details["matchedClaims"] as Array<{ reference: string }>).map((c) => c.reference) ?? [])
        : []
      const count = typeof details["duplicateCount"] === "number" ? details["duplicateCount"] : duplicates.length

      alerts.push({
        type: "DUPLICATE_CLAIM",
        severity: eval_.scoreContribution >= 30 ? "CRITICAL" : "HIGH",
        title: `Duplicate claim: ${claim.reference}`,
        description:
          `Same patient billed for the same service(s) ${count} time(s) at ${claim.hospital.name} ` +
          `within the review window${duplicates.length ? ` (matching claim(s): ${duplicates.join(", ")})` : ""}.`,
        claimId,
        hospitalId: claim.hospitalId,
        source: "RULE",
        metadata: {
          ruleCode: "R-003",
          scoreContribution: eval_.scoreContribution,
          duplicateCount: count,
          matchedClaims: details["matchedClaims"] ?? [],
          explanation: eval_.explanation,
        },
      })
    }

    if (code === "R-007") {
      const parsed = parseExplanation(eval_.explanation)

      // Legacy/equipment form: explanation is a signals array → not a cross-facility finding
      if (Array.isArray(parsed)) continue

      const details = (parsed ?? {}) as Record<string, unknown>
      const matches = Array.isArray(details["serviceSpecificMatches"])
        ? (details["serviceSpecificMatches"] as ServiceMatch[])
        : []
      const periodViolations = Array.isArray(details["periodViolations"])
        ? (details["periodViolations"] as PeriodViolation[])
        : []

      if (matches.length === 0 && periodViolations.length === 0) continue
      if (hasAlert(alerts, "CROSS_FACILITY_ANOMALY", claimId)) continue

      const patientIdentifier =
        (details["patientIdentifier"] as string) ??
        claim.patientReference ??
        "unknown"
      const identifierType =
        details["identifierType"] === "patientId" ? "patient ID" : "patient reference"
      const facilities = [
        ...new Set(
          matches.flatMap((m) =>
            m.matchedClaims.map((mc) => mc.hospitalName)
          )
        ),
      ]
      const matchText = matches
        .map(
          (m) =>
            `${m.serviceCode}: ${m.matchedClaims
              .map(
                (mc) =>
                  `${mc.hospitalName} ${Math.round(mc.daysBetween)} day(s) ago (their claim ${mc.reference})`
              )
              .join("; ")}`
        )
        .join(". ")
      const periodText =
        periodViolations.length > 0
          ? ` ${periodViolations.length} period limit(s) exceeded.`
          : ""

      alerts.push({
        type: "CROSS_FACILITY_ANOMALY",
        severity: eval_.scoreContribution >= 35 ? "CRITICAL" : "HIGH",
        title: `Cross-facility billing: ${claim.reference}`,
        description:
          `Patient (${identifierType} ${patientIdentifier}) was billed for the same service(s) at ` +
          `other facilities within the review window (${facilities.join(", ")}). ${matchText}${periodText}`,
        claimId,
        hospitalId: claim.hospitalId,
        source: "RULE",
        metadata: {
          ruleCode: "R-007",
          scoreContribution: eval_.scoreContribution,
          patientIdentifier,
          identifierType: details["identifierType"] ?? "patientReference",
          serviceSpecificMatches: matches,
          periodViolations,
          explanation: eval_.explanation,
        },
      })
    }
  }

  // Contextual rule evaluations: the explanation is a signals array. Emit one
  // alert per signal, derived from the actual signal — not from rule code.
  for (const eval_ of claim.ruleEvaluations) {
    const parsed = parseExplanation(eval_.explanation)
    if (!Array.isArray(parsed)) continue

    for (const signal of parsed as Signal[]) {
      const mapping = SIGNAL_TO_ALERT[signal.signal]
      if (!mapping) continue
      if (hasAlert(alerts, mapping.type, claimId)) continue

      alerts.push({
        type: mapping.type,
        severity: mapping.severity,
        title: `${humanizeLabel(mapping.type)}: ${claim.reference}`,
        description:
          `Claim ${claim.reference} from ${claim.hospital.name}: ` +
          (signal.explanation ?? eval_.explanation ?? signal.signal),
        claimId,
        hospitalId: claim.hospitalId,
        source: "RULE",
        metadata: {
          ruleCode: eval_.complianceRule.code,
          scoreContribution: eval_.scoreContribution,
          signal: signal.signal,
          signals: parsed,
          explanation: eval_.explanation,
        },
      })
    }
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
        explanation: finding.explanation,
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
