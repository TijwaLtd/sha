"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  ResponsiveDataListing,
  type ColumnDef,
  type FilterConfig,
} from "@/components/shared/responsive-data-listing"
import type { CardAction, CardDetailField } from "@/components/shared/responsive-mobile-card"
import { formatKES } from "@/lib/money"

export interface HospitalOption {
  id: string
  name: string
  facilityIdentifier: string | null
}

export interface ClaimRow {
  id: string
  reference: string
  patientReference: string
  status: string
  itemsCount: number
  submittedAt: string | null
  totalAmountCents: number
  hospital: { name: string; facilityIdentifier: string | null } | null
}

interface ClaimListingProps {
  claims: ClaimRow[]
  hospitals: HospitalOption[]
  currentFilters: { hospitalId: string; status: string; q: string }
}

const statusColors: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-yellow-100 text-yellow-800",
  VALIDATING: "bg-yellow-100 text-yellow-800",
  ANALYZING: "bg-purple-100 text-purple-800",
  ASSESSED: "bg-indigo-100 text-indigo-800",
  CLEARED: "bg-green-100 text-green-800",
  FLAGGED: "bg-red-100 text-red-800",
  UNDER_REVIEW: "bg-orange-100 text-orange-800",
  RESOLVED: "bg-green-100 text-green-800",
}

const PROCESSING_STATUSES = [
  "SUBMITTED",
  "RECEIVED",
  "VALIDATING",
  "ANALYZING",
  "ASSESSED",
]

export function ClaimListing({
  claims,
  hospitals,
  currentFilters,
}: ClaimListingProps) {
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
      key: "hospitalId",
      label: "Hospital",
      value: currentFilters.hospitalId,
      onChange: (value) => updateParam("hospitalId", value),
      options: hospitals.map((h) => ({
        label: h.facilityIdentifier
          ? `${h.name} (${h.facilityIdentifier})`
          : h.name,
        value: h.id,
      })),
    },
    {
      key: "status",
      label: "Status",
      value: currentFilters.status,
      onChange: (value) => updateParam("status", value),
      options: PROCESSING_STATUSES.map((s) => ({
        label: s.replace("_", " "),
        value: s,
      })),
    },
  ]

  const columns: ColumnDef<ClaimRow>[] = [
    {
      header: "Reference",
      cell: (c) => (
        <div className="space-y-0.5">
          <p className="font-semibold font-mono">{c.reference}</p>
          <p className="text-xs text-muted-foreground">{c.patientReference}</p>
        </div>
      ),
    },
    {
      header: "Facility",
      cell: (c) =>
        c.hospital ? (
          <div className="space-y-0.5">
            <p className="text-xs font-medium">{c.hospital.name}</p>
            {c.hospital.facilityIdentifier && (
              <p className="font-mono text-xs text-muted-foreground">
                {c.hospital.facilityIdentifier}
              </p>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      header: "Status",
      cell: (c) => (
        <Badge className={statusColors[c.status] || "bg-gray-100 text-gray-800"}>
          {c.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      header: "Items",
      cell: (c) => <span className="text-xs">{c.itemsCount}</span>,
    },
    {
      header: "Submitted",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString("en-KE") : "—"}
        </span>
      ),
    },
    {
      header: "Amount",
      cell: (c) => (
        <span className="text-xs font-semibold font-mono">
          {formatKES(c.totalAmountCents)}
        </span>
      ),
    },
    {
      header: "",
      className: "w-16",
      cell: (c) => (
        <a
          href={`/sha/claims/${c.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </a>
      ),
    },
  ]

  function toCardActions(c: ClaimRow): CardAction[] {
    return [
      {
        label: "View Claim",
        icon: Eye,
        variant: "outline",
        href: `/sha/claims/${c.id}`,
      },
    ]
  }

  return (
    <ResponsiveDataListing<ClaimRow>
      title="Incoming Claims"
      description={`${claims.length} claim${claims.length !== 1 ? "s" : ""} in processing queue`}
      items={claims}
      columns={columns}
      cardMapper={{
        id: (c) => c.id,
        title: (c) => c.reference,
        subtitle: (c) =>
          c.hospital
            ? `${c.hospital.name}${c.hospital.facilityIdentifier ? ` · ${c.hospital.facilityIdentifier}` : ""}`
            : undefined,
        fallbackIcon: () => <FileText className="h-5 w-5" />,
        statusBadge: (c) => (
          <Badge className={statusColors[c.status] || "bg-gray-100 text-gray-800"}>
            {c.status.replace(/_/g, " ")}
          </Badge>
        ),
        amount: (c) => formatKES(c.totalAmountCents),
        detailFields: (c) => {
          const fields: CardDetailField[] = [
            { label: "Patient", value: c.patientReference || "—" },
            { label: "Facility", value: c.hospital?.name ?? "—" },
            { label: "Items", value: c.itemsCount },
          ]
          if (c.submittedAt) {
            fields.push({
              label: "Submitted",
              value: new Date(c.submittedAt).toLocaleDateString("en-KE"),
            })
          }
          fields.push({ label: "Status", value: c.status.replace(/_/g, " ") })
          return fields
        },
        actions: (c) => toCardActions(c),
        detailHref: (c) => `/sha/claims/${c.id}`,
      }}
      loading={false}
      searchQuery={draft}
      onSearchChange={setDraft}
      onSearchSubmit={() => updateParam("q", draft.trim(), true)}
      searchPlaceholder="Search by reference or patient reference..."
      filters={filters}
      emptyState={{
        icon: FileText,
        title: "No claims in queue",
        description: "No claims match the current filters or search.",
      }}
      rowKey={(c) => c.id}
    />
  )
}