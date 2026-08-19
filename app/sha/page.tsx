import Link from "next/link"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { formatKES } from "@/lib/money"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Building2,
  FileCheck,
  FileWarning,
  Shield,
  TrendingUp,
} from "lucide-react"

export default async function ShaPage() {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()

  const [
    totalClaims,
    claimsByStatus,
    openAlerts,
    criticalAlerts,
    recentAlerts,
    totalHospitals,
    pendingVerifications,
    flaggedClaims,
  ] = await Promise.all([
    db.claim.count({ where: { status: { not: "DRAFT" } } }),
    db.claim.groupBy({ by: ["status"], _count: true }),
    db.alert.count({ where: { status: { in: ["OPEN", "ACKNOWLEDGED", "UNDER_REVIEW"] } } }),
    db.alert.count({ where: { severity: "CRITICAL", status: { in: ["OPEN", "ACKNOWLEDGED"] } } }),
    db.alert.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        claim: { select: { reference: true } },
        hospital: { select: { name: true } },
      },
    }),
    db.hospital.count(),
    db.hospital.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING"] } } }),
    db.claim.findMany({
      where: { status: { in: ["FLAGGED", "UNDER_REVIEW"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        hospital: { select: { name: true } },
        riskScore: true,
      },
    }),
  ])

  const statusCounts = Object.fromEntries(
    claimsByStatus.map((s) => [s.status, s._count])
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor claims, investigate flagged items, and manage compliance
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Claims
              </CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClaims}</div>
              <p className="text-xs text-muted-foreground">
                {statusCounts["CLEARED"] || 0} cleared
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Alerts
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {openAlerts}
              </div>
              {criticalAlerts > 0 && (
                <Badge variant="destructive" className="mt-1">
                  {criticalAlerts} critical
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hospitals
              </CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalHospitals}</div>
              {pendingVerifications > 0 && (
                <p className="text-xs text-orange-600">
                  {pendingVerifications} pending verification
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Flagged Claims
              </CardTitle>
              <FileWarning className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {flaggedClaims.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting review
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Recent Alerts</CardTitle>
                  <CardDescription>Latest compliance alerts</CardDescription>
                </div>
                <Link
                  href="/sha/alerts"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentAlerts.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  <Shield className="mx-auto mb-2 h-6 w-6 text-green-600" />
                  No active alerts
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start justify-between gap-2 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              alert.severity === "CRITICAL"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {alert.severity}
                          </Badge>
                          <span className="truncate text-sm font-medium">
                            {alert.title}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {alert.claim?.reference} •{" "}
                          {alert.hospital?.name}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {alert.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Flagged Claims</CardTitle>
                  <CardDescription>Claims requiring review</CardDescription>
                </div>
                <Link
                  href="/sha/claims"
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {flaggedClaims.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  <Shield className="mx-auto mb-2 h-6 w-6 text-green-600" />
                  No flagged claims
                </p>
              ) : (
                <div className="space-y-3">
                  {flaggedClaims.map((claim) => (
                    <Link
                      key={claim.id}
                      href={`/sha/claims/${claim.id}`}
                      className="flex items-start justify-between gap-2 rounded-md border p-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {claim.reference}
                          </span>
                          <Badge
                            variant={
                              claim.status === "UNDER_REVIEW"
                                ? "default"
                                : "destructive"
                            }
                            className="text-[10px]"
                          >
                            {claim.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {claim.hospital.name} •{" "}
                          {formatKES(claim.totalAmountCents)}
                        </p>
                      </div>
                      {claim.riskScore && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px]"
                        >
                          <TrendingUp className="mr-1 h-3 w-3" />
                          {claim.riskScore.score}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
