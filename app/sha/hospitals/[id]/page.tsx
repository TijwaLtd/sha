import Link from "next/link"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { notFound } from "next/navigation"
import { formatKES } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft } from "lucide-react"
import { VerificationPanel } from "./_components/verification-panel"

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

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()
  const hospital = await db.hospital.findUnique({
    where: { id },
    include: {
      services: { include: { service: true } },
      claims: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          _count: { select: { items: true } },
        },
      },
    },
  })

  if (!hospital) {
    notFound()
  }

  const location = hospital.location as Record<string, string> | null

  const grouped = hospital.services.reduce(
    (acc, hs) => {
      const cat = hs.service.category || "Other"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(hs.service)
      return acc
    },
    {} as Record<string, typeof hospital.services[number]["service"][]>
  )

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/sha/hospitals"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{hospital.name}</h1>
            <p className="text-sm text-muted-foreground">
              {hospital.facilityIdentifier}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
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
                statusColors[hospital.status] || "bg-gray-100 text-gray-800"
              }
            >
              {hospital.status}
            </Badge>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facility Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hospital.type ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Type
                </p>
                <p className="text-sm">{hospital.type.replace(/_/g, " ")}</p>
              </div>
            ) : null}
            {location ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm">{location.county || "N/A"}</p>
                  {location.address ? (
                    <p className="text-xs text-muted-foreground">
                      {location.address}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification</CardTitle>
            <CardDescription>
              Manage facility verification status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerificationPanel
              hospitalId={hospital.id}
              currentStatus={hospital.verificationStatus}
              hasServices={hospital.services.length > 0}
              isActive={hospital.status === "ACTIVE"}
              isRegistered={true}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Services</CardTitle>
            <CardDescription>
              {hospital.services.length} registered service
              {hospital.services.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hospital.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No services registered.
              </p>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {category.replace(/_/g, " ")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((s) => (
                      <Badge key={s.code} variant="secondary">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Claims</CardTitle>
            <CardDescription>Last 5 claims submitted</CardDescription>
          </CardHeader>
          <CardContent>
            {hospital.claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">No claims yet.</p>
            ) : (
              <div className="space-y-2">
                {hospital.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{claim.reference}</p>
                      <p className="text-xs text-muted-foreground">
                        {claim.patientReference}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatKES(claim.totalAmountCents)}
                      </p>
                      <Badge
                        className="text-xs"
                        variant="secondary"
                      >
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
