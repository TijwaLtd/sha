import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { ClaimListing } from "./_components/claim-listing"

const PROCESSING_STATUSES = [
  "SUBMITTED",
  "RECEIVED",
  "VALIDATING",
  "ANALYZING",
  "ASSESSED",
]

interface ClaimsPageProps {
  searchParams: Promise<{
    hospitalId?: string
    status?: string
    q?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {
    status: { in: PROCESSING_STATUSES },
  }

  if (params.hospitalId) {
    where.hospitalId = params.hospitalId
  }

  if (
    params.status &&
    PROCESSING_STATUSES.includes(params.status)
  ) {
    where.status = params.status
  }

  if (params.q) {
    where.OR = [
      { reference: { contains: params.q, mode: "insensitive" } },
      { patientReference: { contains: params.q, mode: "insensitive" } },
    ]
  }

  const [claims, hospitals] = await Promise.all([
    db.claim.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      include: {
        hospital: { select: { name: true, facilityIdentifier: true } },
        _count: { select: { items: true } },
      },
    }),
    db.hospital.findMany({
      select: { id: true, name: true, facilityIdentifier: true },
      orderBy: { name: "asc" },
    }),
  ])

  const rows = claims.map((claim) => ({
    id: claim.id,
    reference: claim.reference,
    patientReference: claim.patientReference,
    status: claim.status,
    itemsCount: claim._count.items,
    submittedAt: claim.submittedAt?.toISOString() ?? null,
    totalAmountCents: claim.totalAmountCents,
    hospital: claim.hospital,
  }))

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <ClaimListing
          claims={rows}
          hospitals={hospitals.map((h) => ({
            id: h.id,
            name: h.name,
            facilityIdentifier: h.facilityIdentifier,
          }))}
          currentFilters={{
            hospitalId: params.hospitalId || "",
            status: params.status || "",
            q: params.q || "",
          }}
        />
      </div>
    </div>
  )
}