import { requireAuth } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { ClaimListing } from "./_components/claim-listing"

const VIEWABLE_STATUSES = [
  "SUBMITTED",
  "RECEIVED",
  "VALIDATING",
  "ANALYZING",
  "ASSESSED",
  "CLEARED",
  "FLAGGED",
  "UNDER_REVIEW",
  "RESOLVED",
]

interface ClaimsPageProps {
  searchParams: Promise<{
    status?: string
    q?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const user = await requireAuth()

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {
    hospitalId: user.hospitalId!,
    status: { not: "DRAFT" },
  }

  if (params.status && VIEWABLE_STATUSES.includes(params.status)) {
    where.status = params.status
  }

  if (params.q) {
    where.OR = [
      { reference: { contains: params.q, mode: "insensitive" } },
      { patientReference: { contains: params.q, mode: "insensitive" } },
    ]
  }

  const claims = await db.claim.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  })

  const rows = claims.map((claim) => ({
    id: claim.id,
    reference: claim.reference,
    patientReference: claim.patientReference,
    status: claim.status,
    itemsCount: claim._count.items,
    submittedAt: claim.submittedAt?.toISOString() ?? null,
    totalAmountCents: claim.totalAmountCents,
  }))

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <ClaimListing
          claims={rows}
          currentFilters={{
            status: params.status || "",
            q: params.q || "",
          }}
        />
      </div>
    </div>
  )
}