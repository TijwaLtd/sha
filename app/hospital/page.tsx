import { requireAuth } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { HospitalProfile } from "./_components/hospital-profile"
import { HospitalServices } from "./_components/hospital-services"

export default async function HospitalPage() {
  const user = await requireAuth()

  const db = createDbClient()
  const hospital = await db.hospital.findUnique({
    where: { id: user.hospitalId! },
    include: {
      services: {
        include: { service: true },
      },
    },
  })

  if (!hospital) {
    return (
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No hospital profile found. Please contact support.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <HospitalProfile
          hospital={{
            id: hospital.id,
            name: hospital.name,
            facilityIdentifier: hospital.facilityIdentifier,
            type: hospital.type,
            status: hospital.status,
            verificationStatus: hospital.verificationStatus,
            location: hospital.location,
          }}
        />
        <HospitalServices services={hospital.services} />
      </div>
    </div>
  )
}
