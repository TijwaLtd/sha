"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  ResponsiveDataListing,
  type ColumnDef,
  type FilterConfig,
} from "@/components/shared/responsive-data-listing"
import type { CardAction, CardDetailField } from "@/components/shared/responsive-mobile-card"

export interface HospitalRow {
  id: string
  name: string
  facilityIdentifier: string | null
  type: string | null
  verificationStatus: string
  status: string
  servicesCount: number
  claimsCount: number
  usersCount: number
}

interface HospitalListingProps {
  hospitals: HospitalRow[]
  currentFilters: { q: string; verification: string; status: string }
}

const verificationColors: Record<string, string> = {
  VERIFIED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  UNVERIFIED: "bg-gray-100 text-gray-800",
  REJECTED: "bg-red-100 text-red-800",
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-red-100 text-red-800",
  UNKNOWN: "bg-yellow-100 text-yellow-800",
}

export function HospitalListing({
  hospitals,
  currentFilters,
}: HospitalListingProps) {
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
      key: "verification",
      label: "Verification",
      value: currentFilters.verification,
      onChange: (value) => updateParam("verification", value),
      options: ["VERIFIED", "PENDING", "UNVERIFIED", "REJECTED"].map((s) => ({
        label: s.replace("_", " "),
        value: s,
      })),
    },
    {
      key: "status",
      label: "Status",
      value: currentFilters.status,
      onChange: (value) => updateParam("status", value),
      options: ["ACTIVE", "INACTIVE", "SUSPENDED", "UNKNOWN"].map((s) => ({
        label: s,
        value: s,
      })),
    },
  ]

  const columns: ColumnDef<HospitalRow>[] = [
    {
      header: "Facility",
      cell: (h) => (
        <div className="space-y-0.5">
          <p className="font-semibold">{h.name}</p>
          {h.facilityIdentifier && (
            <p className="font-mono text-xs text-muted-foreground">
              {h.facilityIdentifier}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Type",
      cell: (h) => (
        <span className="text-xs">{h.type?.replace(/_/g, " ") || "—"}</span>
      ),
    },
    { header: "Services", cell: (h) => <span className="text-xs">{h.servicesCount}</span> },
    { header: "Claims", cell: (h) => <span className="text-xs">{h.claimsCount}</span> },
    { header: "Users", cell: (h) => <span className="text-xs">{h.usersCount}</span> },
    {
      header: "Verification",
      cell: (h) => (
        <Badge
          className={verificationColors[h.verificationStatus] || "bg-gray-100 text-gray-800"}
        >
          {h.verificationStatus}
        </Badge>
      ),
    },
    {
      header: "Status",
      cell: (h) => (
        <Badge className={statusColors[h.status] || "bg-gray-100 text-gray-800"}>
          {h.status}
        </Badge>
      ),
    },
    {
      header: "",
      className: "w-20",
      cell: (h) => (
        <a
          href={`/sha/hospitals/${h.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </a>
      ),
    },
  ]

  function toCardActions(h: HospitalRow): CardAction[] {
    return [
      {
        label: "Open Facility",
        icon: Eye,
        variant: "outline",
        href: `/sha/hospitals/${h.id}`,
      },
    ]
  }

  return (
    <ResponsiveDataListing<HospitalRow>
      title="Hospitals"
      description={`${hospitals.length} registered facilit${hospitals.length !== 1 ? "ies" : "y"}`}
      items={hospitals}
      columns={columns}
      cardMapper={{
        id: (h) => h.id,
        title: (h) => h.name,
        subtitle: (h) =>
          h.facilityIdentifier
            ? `${h.facilityIdentifier} · ${h.type?.replace(/_/g, " ") || "Unknown"}`
            : h.type?.replace(/_/g, " ") || "Unknown",
        fallbackIcon: () => <Building2 className="h-5 w-5" />,
        statusBadge: (h) => (
          <Badge
            className={verificationColors[h.verificationStatus] || "bg-gray-100 text-gray-800"}
          >
            {h.verificationStatus}
          </Badge>
        ),
        detailFields: (h) => {
          const fields: CardDetailField[] = [
            { label: "Type", value: h.type?.replace(/_/g, " ") || "—" },
            { label: "Services", value: h.servicesCount },
            { label: "Claims", value: h.claimsCount },
            { label: "Users", value: h.usersCount },
            { label: "Status", value: h.status },
          ]
          return fields
        },
        actions: (h) => toCardActions(h),
        detailHref: (h) => `/sha/hospitals/${h.id}`,
      }}
      loading={false}
      searchQuery={draft}
      onSearchChange={setDraft}
      onSearchSubmit={() => updateParam("q", draft.trim(), true)}
      searchPlaceholder="Search by name or facility identifier..."
      filters={filters}
      emptyState={{
        icon: Building2,
        title: "No hospitals found",
        description: "No facilities match the current filters or search.",
      }}
      rowKey={(h) => h.id}
    />
  )
}