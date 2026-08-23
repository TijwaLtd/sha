import Link from "next/link"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { notFound } from "next/navigation"
import { formatKES } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle } from "lucide-react"
import { ProcessingTimeline } from "./_components/processing-timeline"

const statusColors: Record<string, string> = {
  RECEIVED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  VALIDATING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  ANALYZING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  ASSESSED:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  CLEARED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FLAGGED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

const severityColors: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  MEDIUM:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()
  const claim = await db.claim.findUnique({
    where: { id },
    include: {
      hospital: {
        select: {
          name: true,
          facilityIdentifier: true,
          verificationStatus: true,
          status: true,
        },
      },
      items: {
        include: { service: true },
        orderBy: { createdAt: "asc" },
      },
      ruleEvaluations: {
        include: { complianceRule: true },
        orderBy: { evaluatedAt: "asc" },
      },
      findings: {
        orderBy: { createdAt: "asc" },
      },
      riskScore: {
        include: { contributors: true },
      },
      alerts: {
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!claim) {
    notFound()
  }

  const triggeredRules = claim.ruleEvaluations.filter((e) => e.triggered)
  const clearedRules = claim.ruleEvaluations.filter((e) => !e.triggered)
  const isProcessed = ["CLEARED", "FLAGGED", "UNDER_REVIEW"].includes(
    claim.status
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/sha/claims"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{claim.reference}</h1>
            <p className="text-sm text-muted-foreground">
              {claim.hospital.name} • {claim.hospital.facilityIdentifier}
            </p>
          </div>
          <Badge
            className={
              statusColors[claim.status] || "bg-gray-100 text-gray-800"
            }
          >
            {claim.status.replace(/_/g, " ")}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Patient Reference
                </p>
                <p>{claim.patientReference}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Submitted
                </p>
                <p>
                  {claim.submittedAt
                    ? new Date(claim.submittedAt).toLocaleDateString("en-KE")
                    : "Not submitted"}
                </p>
              </div>
            </div>
            {claim.diagnosis ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Diagnosis
                  </p>
                  <p className="text-sm">{claim.diagnosis}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{claim.hospital.name}</p>
                <p className="text-xs text-muted-foreground">
                  {claim.hospital.facilityIdentifier}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {claim.hospital.verificationStatus}
                </Badge>
                <Badge variant="secondary">{claim.hospital.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing</CardTitle>
            <CardDescription>
              Claim processing pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProcessingTimeline
              claimId={claim.id}
              currentStatus={claim.status}
            />
          </CardContent>
        </Card>

        {isProcessed && claim.riskScore ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk Assessment</CardTitle>
              <CardDescription>
                Score: {claim.riskScore.score} / 100 • Level:{" "}
                {claim.riskScore.level}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claim.riskScore.contributors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          c.type === "RULE"
                            ? "border-blue-300 text-blue-700"
                            : c.type === "AI"
                              ? "border-purple-300 text-purple-700"
                              : "border-gray-300 text-gray-700"
                        }
                      >
                        {c.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {c.description}
                      </span>
                    </div>
                    <span className="font-medium">+{c.scoreImpact}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isProcessed && triggeredRules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Triggered Rules ({triggeredRules.length})
              </CardTitle>
              <CardDescription>
                Rules that flagged this claim
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {triggeredRules.map((e) => {
                  let explanation = ""
                  try {
                    const parsed = JSON.parse(e.explanation ?? "{}")
                    if (Array.isArray(parsed)) {
                      explanation = parsed
                        .map((s: { explanation?: string }) => s.explanation)
                        .filter(Boolean)
                        .join("; ")
                    } else if (parsed.note) {
                      explanation = parsed.note
                    }
                  } catch {
                    explanation = e.explanation ?? ""
                  }

                  return (
                    <div
                      key={e.id}
                      className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">
                            {e.complianceRule.code}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {e.complianceRule.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={severityColors[e.complianceRule.severity]}>
                            {e.complianceRule.severity}
                          </Badge>
                          <span className="text-sm font-medium">
                            +{e.scoreContribution}
                          </span>
                        </div>
                      </div>
                      {explanation ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {explanation}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isProcessed && clearedRules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Passed Rules ({clearedRules.length})
              </CardTitle>
              <CardDescription>
                Rules that did not trigger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {clearedRules.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-2 rounded-md p-2 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">
                      {e.complianceRule.code}
                    </span>
                    <span className="text-muted-foreground">
                      {e.complianceRule.name}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isProcessed && claim.findings.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Findings ({claim.findings.length})
              </CardTitle>
              <CardDescription>AI and system findings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claim.findings.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            f.source === "AI"
                              ? "border-purple-300 text-purple-700"
                              : "border-blue-300 text-blue-700"
                          }
                        >
                          {f.source}
                        </Badge>
                        <span className="text-sm font-medium">{f.type}</span>
                      </div>
                      <Badge className={severityColors[f.severity]}>
                        {f.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {f.title}
                    </p>
                    {f.explanation ? (
                      <p className="mt-1 text-xs">{f.explanation}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isProcessed && claim.alerts.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Alerts ({claim.alerts.length})
              </CardTitle>
              <CardDescription>Generated alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {claim.alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{a.title}</span>
                        <Badge className={severityColors[a.severity]}>
                          {a.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Items</CardTitle>
            <CardDescription>
              {claim.items.length} item
              {claim.items.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {claim.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.service.name}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatKES(item.unitAmountCents)}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatKES(item.totalAmountCents)}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-semibold">
                {formatKES(claim.totalAmountCents)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
