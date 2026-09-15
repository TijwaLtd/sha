import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { HospitalListing } from "./_components/hospital-listing"

interface HospitalsPageProps {
  searchParams: Promise<{
    q?: string
    verification?: string
    status?: string
  }>
}

export default async function HospitalsPage({
  searchParams,
}: HospitalsPageProps) {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {}
  if (params.verification) where.verificationStatus = params.verification
  if (params.status) where.status = params.status
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { facilityIdentifier: { contains: params.q, mode: "insensitive" } },
    ]
  }

  const hospitals = await db.hospital.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      services: { include: { service: true } },
      _count: { select: { claims: true, users: true } },
    },
  })

  const rows = hospitals.map((h) => ({
    id: h.id,
    name: h.name,
    facilityIdentifier: h.facilityIdentifier,
    type: h.type,
    verificationStatus: h.verificationStatus,
    status: h.status,
    servicesCount: h.services.length,
    claimsCount: h._count.claims,
    usersCount: h._count.users,
  }))

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <HospitalListing
          hospitals={rows}
          currentFilters={{
            q: params.q || "",
            verification: params.verification || "",
            status: params.status || "",
          }}
        />
      </div>
    </div>
  )
}