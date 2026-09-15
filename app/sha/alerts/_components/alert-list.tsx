"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  BellRing,
  Building2,
  CheckCircle2,
  Eye,
  User,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ResponsiveDataListing,
  type ColumnDef,
  type FilterConfig,
  type ListingGroup,
} from "@/components/shared/responsive-data-listing"
import type { CardAction } from "@/components/shared/responsive-mobile-card"
import {
  acknowledgeAlert,
  dismissAlert,
  resolveAlert,
  startReview,
} from "../_actions/alert-actions"
import type {
  AlertStatus,
  AlertType,
  FindingSeverity,
} from "@/app/generated/prisma/enums"
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

interface AlertListingProps {
  alerts: Alert[]
  currentFilters: {
    status: string
    severity: string
    type: string
  }
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

interface Signal {
  signal: string
  severity?: string
  explanation?: string
}

interface ActionDef {
  key: "acknowledge" | "review" | "resolve" | "dismiss"
  label: string
  icon: React.ComponentType<{ className?: string }>
  variant: "default" | "outline" | "ghost"
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

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
}

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  "OPEN",
  "ACKNOWLEDGED",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
].map((s) => ({ label: s.replace("_", " "), value: s }))

const SEVERITY_OPTIONS: Array<{ label: string; value: string }> = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
].map((s) => ({ label: s, value: s }))

// ─── Helpers ───────────────────────────────────────────

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function getPatientIdentifier(alert: Alert): {
  label: string
  id: string | null
} {
  const metadata = alert.metadata ?? {}
  const patientReference = alert.claim?.patientReference
  const patientIdentifier =
    typeof metadata.patientIdentifier === "string"
      ? metadata.patientIdentifier
      : null

  if (patientReference) {
    return { label: patientReference, id: alert.claim?.patientId ?? null }
  }
  if (patientIdentifier) {
    return { label: patientIdentifier, id: alert.claim?.patientId ?? null }
  }
  if (alert.claim?.patientId) {
    return { label: `PID ${alert.claim.patientId.slice(0, 8)}`, id: alert.claim.patientId }
  }
  return { label: "", id: null }
}

function patientGroupKey(alert: Alert): string {
  const { label, id } = getPatientIdentifier(alert)
  if (id) return `patient:${id}`
  if (label) return `patient:ref:${label}`
  return `facility:${alert.hospital?.name ?? "unknown"}`
}

function collectFacilities(items: Alert[]): string[] {
  const seen = new Set<string>()
  for (const alert of items) {
    if (alert.hospital?.name) seen.add(alert.hospital.name)
    const metadata = alert.metadata ?? {}
    for (const match of toArray<ServiceMatch>(metadata.serviceSpecificMatches)) {
      for (const mc of match.matchedClaims) {
        if (mc.hospitalName) seen.add(mc.hospitalName)
      }
    }
  }
  return [...seen]
}

function worstSeverity(items: Alert[]): FindingSeverity {
  return items.reduce<FindingSeverity>(
    (worst, alert) =>
      SEVERITY_RANK[alert.severity] > SEVERITY_RANK[worst]
        ? alert.severity
        : worst,
    items[0]?.severity ?? "LOW"
  )
}

function whyText(alert: Alert): string | null {
  const metadata = alert.metadata ?? {}

  if (alert.type === "AI_REVIEW_REQUIRED") {
    const explanation =
      typeof metadata.explanation === "string" ? metadata.explanation : null
    const findingType =
      typeof metadata.findingType === "string" ? metadata.findingType : null
    return explanation || findingType || alert.description
  }

  if (alert.type === "HIGH_RISK_CLAIM") {
    const riskScore = metadata.riskScore
    if (typeof riskScore === "number") {
      const level =
        typeof metadata.riskLevel === "string" ? metadata.riskLevel : null
      return `Risk score ${riskScore}${level ? ` (${level})` : ""}`
    }
  }

  if (alert.type === "SERVICE_MISMATCH") {
    const missing = toArray<string>(metadata.missingServices)
    if (missing.length > 0) return `Services not authorized: ${missing.join(", ")}`
  }

  if (alert.type === "FACILITY_VERIFICATION") {
    return "Submitted by a facility that is not verified to bill SHA."
  }

  if (alert.type === "CROSS_FACILITY_ANOMALY") {
    const matches = toArray<ServiceMatch>(metadata.serviceSpecificMatches)
    const violations = toArray<PeriodViolation>(metadata.periodViolations)
    const counts = [matches.length, violations.length]
    const total = counts.reduce((sum, n) => sum + n, 0)
    if (total > 0) {
      return `Same service claimed across facilities: ${total} match${total === 1 ? "" : "es"}`
    }
  }

  const signals = toArray<Signal>(metadata.signals)
  if (signals.length > 0) {
    const first = signals.find((s) => s.explanation)
    if (first?.explanation) return first.explanation
  }

  return alert.description
}

function actionDefs(alert: Alert): ActionDef[] {
  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") return []

  const defs: ActionDef[] = []
  if (alert.status === "OPEN") {
    defs.push({
      key: "acknowledge",
      label: "Acknowledge",
      icon: CheckCircle2,
      variant: "outline",
    })
    defs.push({
      key: "review",
      label: "Start Review",
      icon: Eye,
      variant: "default",
    })
  }
  if (alert.status === "ACKNOWLEDGED") {
    defs.push({
      key: "review",
      label: "Start Review",
      icon: Eye,
      variant: "default",
    })
  }
  if (alert.status === "UNDER_REVIEW" || alert.status === "ACKNOWLEDGED") {
    defs.push({
      key: "resolve",
      label: "Resolve",
      icon: CheckCircle2,
      variant: "default",
    })
    defs.push({
      key: "dismiss",
      label: "Dismiss",
      icon: XCircle,
      variant: "ghost",
    })
  }
  return defs
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-KE")
}

// ─── Listing ───────────────────────────────────────────

export function AlertListing({ alerts, currentFilters }: AlertListingProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<string | null>(null)

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

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
      router.refresh()
    }
  }

  const typeOptions = [...new Set(alerts.map((a) => a.type))]
    .sort()
    .map((t) => ({ label: t.replace(/_/g, " "), value: t }))

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      value: currentFilters.status,
      onChange: (value) => setFilter("status", value),
      options: STATUS_OPTIONS,
    },
    {
      key: "severity",
      label: "Severity",
      value: currentFilters.severity,
      onChange: (value) => setFilter("severity", value),
      options: SEVERITY_OPTIONS,
    },
    {
      key: "type",
      label: "Type",
      value: currentFilters.type,
      onChange: (value) => setFilter("type", value),
      options: typeOptions,
    },
  ]

  const columns: ColumnDef<Alert>[] = [
    {
      header: "Severity",
      cell: (a) => (
        <Badge className={severityColors[a.severity]}>{a.severity}</Badge>
      ),
    },
    {
      header: "Status",
      cell: (a) => (
        <Badge className={statusColors[a.status]}>
          {a.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Type",
      cell: (a) => (
        <span className="text-xs font-medium">{a.type.replace(/_/g, " ")}</span>
      ),
    },
    {
      header: "Patient",
      cell: (a) => {
        const { label, id } = getPatientIdentifier(a)
        return (
          <div className="space-y-0.5">
            <p className="font-medium">{label || "—"}</p>
            {id && (
              <p className="font-mono text-xs text-muted-foreground">
                {id.slice(0, 8)}
              </p>
            )}
          </div>
        )
      },
    },
    {
      header: "Claim",
      cell: (a) =>
        a.claim && a.claimId ? (
          <div className="space-y-0.5">
            <Link
              href={`/sha/claims/${a.claimId}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {a.claim.reference}
            </Link>
            {a.claim.totalAmountCents > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatKES(a.claim.totalAmountCents)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: "Facility",
      cell: (a) =>
        a.hospital ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{a.hospital.name}</p>
            {a.hospital.facilityIdentifier && (
              <p className="font-mono text-xs text-muted-foreground">
                {a.hospital.facilityIdentifier}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: "Raised",
      cell: (a) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(a.createdAt)}
        </span>
      ),
    },
    {
      header: "Actions",
      className: "w-64",
      cell: (a) => (
        <div className="flex flex-wrap gap-1.5">
          {actionDefs(a).map((def) => {
            const Icon = def.icon
            return (
              <Button
                key={def.key}
                size="sm"
                variant={def.variant}
                disabled={loading === a.id}
                onClick={() => handleAction(a.id, def.key)}
                className="h-7 px-2 text-[11px] gap-1"
              >
                <Icon className="h-3 w-3" />
                {def.label}
              </Button>
            )
          })}
        </div>
      ),
    },
  ]

  function toCardActions(a: Alert): CardAction[] {
    return actionDefs(a).map((def) => ({
      label: def.label,
      icon: def.icon,
      variant: def.variant,
      onClick: () => handleAction(a.id, def.key),
    }))
  }

  function renderGroupHeader(group: ListingGroup<Alert>) {
    const { label, id } = getPatientIdentifier(group.items[0])
    const facilities = collectFacilities(group.items)
    const severity = worstSeverity(group.items)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 normal-case tracking-normal">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-sm font-semibold">
            {label || "No patient linked"}
          </span>
          {id && (
            <span className="font-mono text-xs text-muted-foreground">
              {id.slice(0, 8)}
            </span>
          )}
          {facilities.map((facility) => (
            <span
              key={facility}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            >
              <Building2 className="h-3 w-3" />
              {facility}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={severityColors[severity]}>{severity}</Badge>
          <Badge variant="secondary">
            {group.items.length} alert{group.items.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <ResponsiveDataListing<Alert>
      title="Alerts"
      description="Monitor and manage compliance alerts"
      items={alerts}
      columns={columns}
      cardMapper={{
        id: (a) => a.id,
        title: (a) => a.title,
        subtitle: (a) =>
          a.claim ? a.claim.reference : a.hospital?.name ?? undefined,
        fallbackIcon: () => <BellRing className="h-5 w-5" />,
        statusBadge: (a) => (
          <Badge className={severityColors[a.severity]}>{a.severity}</Badge>
        ),
        detailFields: (a) => {
          const { label, id } = getPatientIdentifier(a)
          const fields = [
            { label: "Type", value: a.type.replace(/_/g, " ") },
            { label: "Status", value: a.status.replace("_", " ") },
            { label: "Patient", value: label || "—" },
            { label: "Facility", value: a.hospital?.name ?? "—" },
          ]
          if (id) fields.push({ label: "Patient ID", value: id.slice(0, 8) })
          if (a.claim?.submittedAt) {
            fields.push({ label: "Submitted", value: formatDate(a.claim.submittedAt) })
          }
          if (a.claim && a.claim.totalAmountCents > 0) {
            fields.push({ label: "Amount", value: formatKES(a.claim.totalAmountCents) })
          }
          fields.push({ label: "Raised", value: formatDate(a.createdAt) })
          return fields
        },
        description: (a) => whyText(a),
        actions: (a) => toCardActions(a),
        detailHref: (a) => (a.claimId ? `/sha/claims/${a.claimId}` : undefined),
      }}
      loading={false}
      filters={filters}
      groupBy={{
        key: (a) => patientGroupKey(a),
        header: (group) => renderGroupHeader(group),
      }}
      emptyState={{
        icon: BellRing,
        title: "No alerts",
        description: "No alerts match the current filters.",
      }}
      rowKey={(a) => a.id}
    />
  )
}