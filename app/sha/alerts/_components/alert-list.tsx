"use client"

import { useState } from "react"
import Link from "next/link"
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
  claim: { reference: string } | null
  hospital: { name: string } | null
}

interface AlertListProps {
  alerts: Alert[]
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
        <Card key={alert.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={severityColors[alert.severity]}>
                    {alert.severity}
                  </Badge>
                  <Badge className={statusColors[alert.status]}>
                    {alert.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline">{alert.type.replace("_", " ")}</Badge>
                </div>
                <CardTitle className="text-base">{alert.title}</CardTitle>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                {new Date(alert.createdAt).toLocaleDateString()}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {alert.description && (
              <p className="mb-3 text-sm text-muted-foreground">
                {alert.description}
              </p>
            )}

            <div className="mb-4 flex flex-wrap gap-4 text-sm">
              {alert.claim && (
                <div>
                  <span className="text-muted-foreground">Claim:</span>{" "}
                  <Link
                    href={`/sha/claims/${alert.claimId}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {alert.claim.reference}
                  </Link>
                </div>
              )}
              {alert.hospital && (
                <div>
                  <span className="text-muted-foreground">Facility:</span>{" "}
                  <span className="font-medium">{alert.hospital.name}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Source:</span>{" "}
                <span className="font-medium">{alert.source}</span>
              </div>
            </div>

            {alert.status !== "RESOLVED" && alert.status !== "DISMISSED" && (
              <div className="flex flex-wrap gap-2">
                {alert.status === "OPEN" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === alert.id}
                      onClick={() => handleAction(alert.id, "acknowledge")}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      disabled={loading === alert.id}
                      onClick={() => handleAction(alert.id, "review")}
                    >
                      Start Review
                    </Button>
                  </>
                )}
                {alert.status === "ACKNOWLEDGED" && (
                  <Button
                    size="sm"
                    disabled={loading === alert.id}
                    onClick={() => handleAction(alert.id, "review")}
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
                      disabled={loading === alert.id}
                      onClick={() => handleAction(alert.id, "resolve")}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading === alert.id}
                      onClick={() => handleAction(alert.id, "dismiss")}
                    >
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
