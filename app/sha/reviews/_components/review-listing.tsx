"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ClipboardCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  ResponsiveDataListing,
  type ColumnDef,
  type FilterConfig,
} from "@/components/shared/responsive-data-listing"
import type { CardAction, CardDetailField } from "@/components/shared/responsive-mobile-card"
import { formatKES } from "@/lib/money"

export interface ReviewRow {
  id: string
  status: string
  outcome: string | null
  notes: string | null
  createdAt: string
  claim: {
    id: string
    reference: string
    totalAmountCents: number
    claimStatus: string
    hospitalName: string | null
  }
  reviewerName: string
  actionCount: number
}

interface ReviewListingProps {
  reviews: ReviewRow[]
  currentFilters: { status: string; outcome: string; q: string }
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
}

const outcomeColors: Record<string, string> = {
  CLEARED: "bg-green-100 text-green-800",
  CONFIRMED_ANOMALY: "bg-red-100 text-red-800",
  REJECTED_CLAIM: "bg-red-100 text-red-800",
  ESCALATED: "bg-orange-100 text-orange-800",
  NEEDS_MORE_INFORMATION: "bg-yellow-100 text-yellow-800",
}

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED"]

const OUTCOME_OPTIONS = [
  "CLEARED",
  "CONFIRMED_ANOMALY",
  "REJECTED_CLAIM",
  "ESCALATED",
  "NEEDS_MORE_INFORMATION",
]

export function ReviewListing({ reviews, currentFilters }: ReviewListingProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [draft, setDraft] = useState(currentFilters.q)

  function updateParam(key: string, value: string, submit = false) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (submit || key !== "q") {
      router.push(`?${params.toString()}`)
    }
  }

  const filters: FilterConfig[] = [
    {
      key: "status",
      label: "Status",
      value: currentFilters.status,
      onChange: (value) => updateParam("status", value),
      options: STATUS_OPTIONS.map((s) => ({ label: s.replace("_", " "), value: s })),
    },
    {
      key: "outcome",
      label: "Outcome",
      value: currentFilters.outcome,
      onChange: (value) => updateParam("outcome", value),
      options: OUTCOME_OPTIONS.map((s) => ({
        label: s.replace(/_/g, " "),
        value: s,
      })),
    },
  ]

  const columns: ColumnDef<ReviewRow>[] = [
    {
      header: "Case",
      cell: (r) => (
        <div className="space-y-0.5">
          <p className="font-semibold font-mono">{r.claim.reference}</p>
          {r.claim.hospitalName && (
            <p className="text-xs text-muted-foreground">
              {r.claim.hospitalName}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Investigator",
      cell: (r) => <span className="text-xs">{r.reviewerName}</span>,
    },
    {
      header: "Status",
      cell: (r) => (
        <Badge className={statusColors[r.status] || "bg-gray-100 text-gray-800"}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      header: "Outcome",
      cell: (r) =>
        r.outcome ? (
          <Badge className={outcomeColors[r.outcome] || "bg-gray-100 text-gray-800"}>
            {r.outcome.replace(/_/g, " ")}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: "Amount",
      cell: (r) => (
        <span className="text-xs font-semibold font-mono">
          {formatKES(r.claim.totalAmountCents)}
        </span>
      ),
    },
    {
      header: "",
      className: "w-16",
      cell: (r) => (
        <a
          href={`/sha/claims/${r.claim.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </a>
      ),
    },
  ]

  function toCardActions(r: ReviewRow): CardAction[] {
    return [
      {
        label: "Open Investigation",
        icon: ClipboardCheck,
        variant: "default",
        href: `/sha/claims/${r.claim.id}`,
      },
    ]
  }

  return (
    <ResponsiveDataListing<ReviewRow>
      title="Reviews"
      description={`${reviews.length} investigation${reviews.length !== 1 ? "s" : ""}`}
      items={reviews}
      columns={columns}
      cardMapper={{
        id: (r) => r.id,
        title: (r) => r.claim.reference,
        subtitle: (r) =>
          [r.claim.hospitalName, r.reviewerName ? `Investigator: ${r.reviewerName}` : ""]
            .filter(Boolean)
            .join(" · ") || undefined,
        fallbackIcon: () => <ClipboardCheck className="h-5 w-5" />,
        statusBadge: (r) => (
          <Badge className={statusColors[r.status] || "bg-gray-100 text-gray-800"}>
            {r.status.replace(/_/g, " ")}
          </Badge>
        ),
        amount: (r) => formatKES(r.claim.totalAmountCents),
        detailFields: (r) => {
          const fields: CardDetailField[] = [
            { label: "Investigator", value: r.reviewerName },
            { label: "Claim status", value: r.claim.claimStatus.replace(/_/g, " ") },
            { label: "Actions", value: r.actionCount },
          ]
          if (r.outcome) {
            fields.push({ label: "Outcome", value: r.outcome.replace(/_/g, " ") })
          }
          fields.push({
            label: "Started",
            value: new Date(r.createdAt).toLocaleDateString("en-KE"),
          })
          return fields
        },
        description: (r) => r.notes || null,
        actions: (r) => toCardActions(r),
        detailHref: (r) => `/sha/claims/${r.claim.id}`,
      }}
      loading={false}
      searchQuery={draft}
      onSearchChange={setDraft}
      onSearchSubmit={() => updateParam("q", draft.trim(), true)}
      searchPlaceholder="Search by claim reference or facility..."
      filters={filters}
      emptyState={{
        icon: ClipboardCheck,
        title: "No investigations yet",
        description: "Suspicious claims flagged for review will appear here.",
      }}
      rowKey={(r) => r.id}
    />
  )
}