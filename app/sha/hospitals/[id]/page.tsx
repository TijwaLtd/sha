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
import {
  ArrowLeft,
  Wrench,
  Users,
  Clock,
  Award,
  DollarSign,
  Activity,
  Shield,
} from "lucide-react"
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

const equipmentStatusColors: Record<string, string> = {
  OPERATIONAL:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  MAINTENANCE:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RETIRED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  UNAVAILABLE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

const dayOrder = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

const dayLabels: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
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
      facilityLevel: true,
      services: { include: { service: true } },
      equipment: {
        include: {
          equipmentType: true,
          maintenance: { orderBy: { startDate: "desc" }, take: 1 },
        },
      },
      staff: { include: { staffType: true } },
      operatingHours: { orderBy: { dayOfWeek: "asc" } },
      serviceCapabilities: { include: { service: true } },
      tariffs: { include: { service: true }, where: { active: true } },
      serviceCapacities: { include: { service: true } },
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
    {} as Record<string, (typeof hospital.services)[number]["service"][]>
  )

  const staffByType = hospital.staff.reduce(
    (acc, s) => {
      const typeName = s.staffType.name
      if (!acc[typeName]) acc[typeName] = { total: 0, active: 0 }
      acc[typeName].total += s.quantity
      acc[typeName].active += s.activeQuantity
      return acc
    },
    {} as Record<string, { total: number; active: number }>
  )

  const accreditedServices = hospital.serviceCapabilities.filter(
    (sc) => sc.isAccredited
  )
  const offeredServices = hospital.serviceCapabilities.filter(
    (sc) => sc.isOffered && !sc.isAccredited
  )

  const sortedHours = [...hospital.operatingHours].sort(
    (a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek)
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

        {hospital.facilityLevel ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Facility Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm">
                  Level {hospital.facilityLevel.rank}
                </Badge>
                <div>
                  <p className="text-sm font-medium">
                    {hospital.facilityLevel.name}
                  </p>
                  {hospital.facilityLevel.description ? (
                    <p className="text-xs text-muted-foreground">
                      {hospital.facilityLevel.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" />
              Equipment
            </CardTitle>
            <CardDescription>
              {hospital.equipment.length} equipment type
              {hospital.equipment.length !== 1 ? "s" : ""} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hospital.equipment.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No equipment registered.
              </p>
            ) : (
              <div className="space-y-2">
                {hospital.equipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {eq.equipmentType.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {eq.quantity} | Operational:{" "}
                        {eq.operationalQuantity}
                      </p>
                      {eq.maintenance[0] ? (
                        <p className="text-xs text-muted-foreground">
                          Last maintenance:{" "}
                          {eq.maintenance[0].startDate.toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    <Badge
                      className={
                        equipmentStatusColors[eq.status] ||
                        "bg-gray-100 text-gray-800"
                      }
                    >
                      {eq.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Staff
            </CardTitle>
            <CardDescription>
              {Object.keys(staffByType).length} staff type
              {Object.keys(staffByType).length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(staffByType).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff registered.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(staffByType).map(([typeName, counts]) => (
                  <div
                    key={typeName}
                    className="rounded-md border p-3"
                  >
                    <p className="text-sm font-medium">{typeName}</p>
                    <p className="text-xs text-muted-foreground">
                      Total: {counts.total} | Active: {counts.active}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Operating Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No operating hours configured.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {sortedHours.map((h) => (
                  <div
                    key={`${h.dayOfWeek}-${h.serviceCode ?? "default"}`}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {dayLabels[h.dayOfWeek]}
                      </p>
                      {h.serviceCode ? (
                        <p className="text-xs text-muted-foreground">
                          {h.serviceCode}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {!h.isOpen ? (
                        <Badge variant="secondary">Closed</Badge>
                      ) : h.is24Hour ? (
                        <Badge variant="secondary">24 Hours</Badge>
                      ) : (
                        <p className="text-sm">
                          {h.openTime} – {h.closeTime}
                        </p>
                      )}
                      {h.hasEmergency ? (
                        <Badge
                          variant="outline"
                          className="mt-1 text-xs"
                        >
                          Emergency
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4" />
              Service Capabilities
            </CardTitle>
            <CardDescription>
              Accredited and offered services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hospital.serviceCapabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No service capabilities registered.
              </p>
            ) : (
              <>
                {accreditedServices.length > 0 ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">
                      <Shield className="h-3 w-3" />
                      Accredited
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {accreditedServices.map((sc) => (
                        <Badge
                          key={sc.id}
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        >
                          {sc.service.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {offeredServices.length > 0 ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      Offered (Not Accredited)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {offeredServices.map((sc) => (
                        <Badge key={sc.id} variant="secondary">
                          {sc.service.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Service Tariffs
            </CardTitle>
            <CardDescription>
              Applicable tariffs for services
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hospital.tariffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tariffs registered.
              </p>
            ) : (
              <div className="space-y-2">
                {hospital.tariffs.map((tariff) => (
                  <div
                    key={tariff.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {tariff.service.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tariff.patientCategory
                          ? tariff.patientCategory.replace(/_/g, " ")
                          : "All patients"}
                        {tariff.source ? ` · ${tariff.source}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatKES(tariff.unitAmountCents)}
                      </p>
                      {tariff.minAmountCents && tariff.maxAmountCents ? (
                        <p className="text-xs text-muted-foreground">
                          {formatKES(tariff.minAmountCents)} –{" "}
                          {formatKES(tariff.maxAmountCents)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
