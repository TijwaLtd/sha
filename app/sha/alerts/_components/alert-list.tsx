"use client"

import { useState } from "react"
import Link from "next/link"
import { User, Building2, FileText, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  acknowledgeAlert,
  dismissAlert,
  resolveAlert,
  startReview,
} from "../_actions/alert-actions"
import type { AlertStatus, AlertType, FindingSeverity } from "@/app/generated/prisma/enums"
import { formatKES } from "@/lib/money"

interface ClaimInfo {
  reference: string
  patientReference: string
  patientId: string | null
  submittedAt: Date | null
  totalAmountCents: number
}

interface Alert {
  id: string
  type: AlertType
  severity: FindingSeverity
  status: AlertStatus
  title: string
  description: string | null
  source: string
  claimId: string | null
  createdAt: Date
  metadata: Record<string, unknown> | null
  claim: ClaimInfo | null
  hospital: { name: string; facilityIdentifier: string | null } | null
}

interface AlertListProps {
  alerts: Alert[]
}

interface ServiceMatch {
  serviceId: string
  serviceCode: string
  matchedClaims: Array<{
    claimId: string
    reference: string
    hospitalName: string
    facilityIdentifier: string
    submittedAt: Date | string
    daysBetween: number
  }>
}

interface PeriodViolation {
  serviceCode: string
  maxClaims: number
  periodDays: number
  actualClaims: number
}

interface DuplicateClaim {
  reference: string
  submittedAt: Date | string
  services: string[]
  totalAmountCents: number
}

interface Signal {
  signal: string
  severity?: string
  explanation?: string
}

const severityColors: Record<FindingSeverity, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
}

const statusColors: Record<AlertStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  ACKNOWLEDGED: "bg-purple-100 text-purple-800",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800",
  RESOLVED: "bg-green-100 text-green-800",
  DISMISSED: "bg-gray-100 text-gray-800",
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-KE")
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function formatDays(days: number): string {
  const rounded = Math.round(days)
  return `${rounded} day${rounded === 1 ? "" : "s"} earlier`
}

export function AlertList({ alerts }: AlertListProps) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAction(alertId: string, action: string) {
    setLoading(alertId)
    try {
      switch (action) {
        case "acknowledge":
          await acknowledgeAlert(alertId)
          break
        case "review":
          await startReview(alertId)
          break
        case "resolve":
          await resolveAlert(alertId)
          break
        case "dismiss":
          await dismissAlert(alertId, "No action required")
          break
      }
    } finally {
      setLoading(null)
    }
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No alerts match the current filters.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          loading={loading === alert.id}
          onAction={handleAction}
        />
      ))}
    </div>
  )
}

function AlertCard({
  alert,
  loading,
  onAction,
}: {
  alert: Alert
  loading: boolean
  onAction: (alertId: string, action: string) => void
}) {
  const metadata = alert.metadata ?? {}

  const patientReference =
    alert.claim?.patientReference ||
    (typeof metadata.patientIdentifier === "string"
      ? metadata.patientIdentifier
      : "") ||
    (alert.claim?.patientId ? `PID ${alert.claim.patientId.slice(0, 8)}` : "")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={severityColors[alert.severity]}>
                {alert.severity}
              </Badge>
              <Badge className={statusColors[alert.status]}>
                {alert.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline">{alert.type.replace(/_/g, " ")}</Badge>
            </div>
            <CardTitle className="text-base">{alert.title}</CardTitle>
          </div>
          <div className="shrink-0 text-right text-sm text-muted-foreground">
            {formatDate(alert.createdAt)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {alert.description && (
          <p className="text-sm text-foreground">{alert.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-4">
          <div className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Patient Ref
              </p>
              <p className="font-medium">{patientReference || "—"}</p>
              {alert.claim?.patientId && (
                <p className="text-xs text-muted-foreground">
                  {alert.claim.patientId.slice(0, 8)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Facility
              </p>
              <p className="font-medium">{alert.hospital?.name || "—"}</p>
              {alert.hospital?.facilityIdentifier && (
                <p className="text-xs text-muted-foreground">
                  {alert.hospital.facilityIdentifier}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Claim
              </p>
              {alert.claim ? (
                <Link
                  href={`/sha/claims/${alert.claimId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {alert.claim.reference}
                </Link>
              ) : (
                <p className="font-medium">—</p>
              )}
              {alert.claim?.submittedAt && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(alert.claim.submittedAt)} ·{" "}
                  {formatKES(alert.claim.totalAmountCents)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Source
              </p>
              <p className="font-medium">{alert.source}</p>
            </div>
          </div>
        </div>

        <TriggerDetails alert={alert} />

        {alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
          <div className="flex flex-wrap gap-2">
            {alert.status === "OPEN" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => onAction(alert.id, "acknowledge")}
                >
                  Acknowledge
                </Button>
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => onAction(alert.id, "review")}
                >
                  Start Review
                </Button>
              </>
            )}
            {alert.status === "ACKNOWLEDGED" && (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => onAction(alert.id, "review")}
              >
                Start Review
              </Button>
            )}
            {(alert.status === "UNDER_REVIEW" ||
              alert.status === "ACKNOWLEDGED") && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  disabled={loading}
                  onClick={() => onAction(alert.id, "resolve")}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => onAction(alert.id, "dismiss")}
                >
                  Dismiss
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TriggerDetails({ alert }: { alert: Alert }) {
  const metadata = alert.metadata ?? {}

  if (alert.type === "CROSS_FACILITY_ANOMALY") {
    const matches = toArray<ServiceMatch>(metadata.serviceSpecificMatches)
    const violations = toArray<PeriodViolation>(metadata.periodViolations)
    if (matches.length === 0 && violations.length === 0) return null

    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cross-facility activity for this patient
        </p>
        <div className="space-y-2">
          {matches.map((match) =>
            match.matchedClaims.map((mc) => (
              <div
                key={mc.claimId}
                className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{match.serviceCode}</p>
                  <p className="text-xs text-muted-foreground">
                    Same service claimed at{" "}
                    <span className="font-medium text-foreground">
                      {mc.hospitalName}
                    </span>{" "}
                    · {formatDays(mc.daysBetween)}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium">claim {mc.reference}</p>
                  <p className="text-muted-foreground">
                    {formatDate(mc.submittedAt)}
                  </p>
                </div>
              </div>
            ))
          )}
          {violations.map((v, idx) => (
            <div
              key={idx}
              className="rounded-md border border-amber-300 bg-background px-3 py-2 text-xs"
            >
              <span className="font-medium">{v.serviceCode}</span>:{" "}
              {v.actualClaims} claims in {v.periodDays} days (allowed:{" "}
              {v.maxClaims})
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (alert.type === "DUPLICATE_CLAIM") {
    const duplicates = toArray<DuplicateClaim>(metadata.matchedClaims)
    if (duplicates.length === 0) return null

    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Matching claim(s) at the same facility
        </p>
        <div className="space-y-2">
          {duplicates.map((dup, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  claim {dup.reference}
                  {dup.services.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {dup.services.join(", ")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(dup.submittedAt)}
                </p>
              </div>
              {dup.totalAmountCents > 0 && (
                <p className="text-xs font-medium">
                  {formatKES(dup.totalAmountCents)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (alert.type === "HIGH_RISK_CLAIM") {
    const riskScore = metadata.riskScore
    if (typeof riskScore !== "number") return null
    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Risk assessment
        </p>
        <p className="mt-1 text-sm">
          Risk score{" "}
          <span className="font-semibold">{riskScore}</span>
          {typeof metadata.riskLevel === "string" &&
            ` (${metadata.riskLevel})`}
        </p>
      </div>
    )
  }

  if (alert.type === "FACILITY_VERIFICATION") {
    const status =
      typeof metadata.verificationStatus === "string"
        ? metadata.verificationStatus
        : null
    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Why this was raised
        </p>
        <p className="text-sm">
          Claim was submitted by a facility that is not verified to bill SHA.
          {status && (
            <span className="ml-1 font-medium">
              Facility status: {status}
            </span>
          )}
        </p>
      </div>
    )
  }

  if (alert.type === "SERVICE_MISMATCH") {
    const missing = toArray<string>(metadata.missingServices)
    if (missing.length === 0) return null
    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Services not authorized for this facility
        </p>
        <div className="flex flex-wrap gap-2">
          {missing.map((service, idx) => (
            <Badge key={idx} variant="outline">
              {service}
            </Badge>
          ))}
        </div>
      </div>
    )
  }

  if (alert.type === "AI_REVIEW_REQUIRED") {
    const findingType =
      typeof metadata.findingType === "string" ? metadata.findingType : null
    const confidence =
      typeof metadata.confidence === "number" ? metadata.confidence : null
    const explanation =
      typeof metadata.explanation === "string" ? metadata.explanation : null
    if (!findingType && !explanation) return null
    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AI finding
        </p>
        <p className="text-sm">{explanation || findingType}</p>
        {(findingType || confidence !== null) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {findingType && (
              <Badge variant="outline">{findingType}</Badge>
            )}
            {confidence !== null && (
              <Badge variant="secondary">
                Confidence {Math.round(confidence * 100)}%
              </Badge>
            )}
          </div>
        )}
      </div>
    )
  }

  const signals = toArray<Signal>(metadata.signals)
  if (signals.length > 0) {
    return (
      <div className="rounded-md border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Why this was raised
        </p>
        <ul className="space-y-1.5">
          {signals.map((signal, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>
                {signal.explanation || signal.signal}
                {signal.severity && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {signal.severity}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return null
}