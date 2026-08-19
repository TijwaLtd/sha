import { Suspense } from "react"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { AlertSummaryCards } from "./_components/alert-summary-cards"
import { AlertList } from "./_components/alert-list"
import { AlertFilters } from "./_components/alert-filters"

interface AlertsPageProps {
  searchParams: Promise<{
    status?: string
    severity?: string
    type?: string
  }>
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {}
  if (params.status) where.status = params.status
  if (params.severity) where.severity = params.severity
  if (params.type) where.type = params.type

  const [alerts, summary] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy: [
        { severity: "desc" },
        { createdAt: "desc" },
      ],
      include: {
        claim: { select: { reference: true } },
        hospital: { select: { name: true } },
      },
    }),
    db.alert.groupBy({
      by: ["status", "severity"],
      _count: true,
    }),
  ])

  const summaryData = {
    total: summary.reduce((sum, s) => sum + s._count, 0),
    open: summary
      .filter((s) => s.status === "OPEN")
      .reduce((sum, s) => sum + s._count, 0),
    critical: summary
      .filter((s) => s.severity === "CRITICAL" && s.status !== "RESOLVED" && s.status !== "DISMISSED")
      .reduce((sum, s) => sum + s._count, 0),
    high: summary
      .filter((s) => s.severity === "HIGH" && s.status !== "RESOLVED" && s.status !== "DISMISSED")
      .reduce((sum, s) => sum + s._count, 0),
    medium: summary
      .filter((s) => s.severity === "MEDIUM" && s.status !== "RESOLVED" && s.status !== "DISMISSED")
      .reduce((sum, s) => sum + s._count, 0),
    resolved: summary
      .filter((s) => s.status === "RESOLVED")
      .reduce((sum, s) => sum + s._count, 0),
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage compliance alerts
          </p>
        </div>

        <AlertSummaryCards {...summaryData} />

        <Suspense fallback={<div>Loading filters...</div>}>
          <AlertFilters
            currentFilters={{
              status: params.status || "",
              severity: params.severity || "",
              type: params.type || "",
            }}
          />
        </Suspense>

        <AlertList
          alerts={alerts.map((a) => ({
            ...a,
            createdAt: a.createdAt,
          }))}
        />
      </div>
    </div>
  )
}
