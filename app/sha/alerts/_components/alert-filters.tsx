"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

interface AlertFiltersProps {
  currentFilters: {
    status: string
    severity: string
    type: string
  }
}

export function AlertFilters({ currentFilters }: AlertFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
  }

  const statuses = ["", "OPEN", "ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]
  const severities = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"]
  const types = [
    "",
    "HIGH_RISK_CLAIM",
    "FACILITY_VERIFICATION",
    "SERVICE_MISMATCH",
    "UNUSUAL_BILLING",
    "DUPLICATE_CLAIM",
    "AI_REVIEW_REQUIRED",
  ]

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Status</div>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={
                currentFilters.status === status ? "default" : "outline"
              }
              onClick={() => setFilter("status", status)}
            >
              {status ? status.replace("_", " ") : "All"}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Severity</div>
        <div className="flex flex-wrap gap-2">
          {severities.map((severity) => (
            <Button
              key={severity}
              size="sm"
              variant={
                currentFilters.severity === severity ? "default" : "outline"
              }
              onClick={() => setFilter("severity", severity)}
            >
              {severity || "All"}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Type</div>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={currentFilters.type === type ? "default" : "outline"}
              onClick={() => setFilter("type", type)}
            >
              {type ? type.replace(/_/g, " ") : "All"}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
