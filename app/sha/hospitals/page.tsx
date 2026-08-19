import Link from "next/link"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const verificationColors: Record<string, string> = {
  VERIFIED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  UNVERIFIED:
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  INACTIVE:
    "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  UNKNOWN:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
}

export default async function HospitalsPage() {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()
  const hospitals = await db.hospital.findMany({
    orderBy: { name: "asc" },
    include: {
      services: { include: { service: true } },
      _count: { select: { claims: true, users: true } },
    },
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Hospitals</h1>
          <p className="text-sm text-muted-foreground">
            {hospitals.length} registered facilit{hospitals.length !== 1 ? "ies" : "y"}
          </p>
        </div>

        <div className="space-y-3">
          {hospitals.map((hospital) => (
            <Link key={hospital.id} href={`/sha/hospitals/${hospital.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {hospital.name}
                      </CardTitle>
                      <CardDescription>
                        {hospital.facilityIdentifier} • {hospital.type?.replace(/_/g, " ") || "Unknown"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        className={
                          verificationColors[hospital.verificationStatus] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {hospital.verificationStatus}
                      </Badge>
                      <Badge
                        className={
                          statusColors[hospital.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {hospital.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {hospital.services.length} service
                      {hospital.services.length !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {hospital._count.claims} claim
                      {hospital._count.claims !== 1 ? "s" : ""}
                    </span>
                    <span>
                      {hospital._count.users} user
                      {hospital._count.users !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
