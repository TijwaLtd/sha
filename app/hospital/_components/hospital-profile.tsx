import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { VerificationStatus, HospitalStatus } from "@/app/generated/prisma/enums"

interface HospitalProfileProps {
  hospital: {
    id: string
    name: string
    facilityIdentifier: string
    type: string | null
    status: HospitalStatus
    verificationStatus: VerificationStatus
    location: unknown
  }
}

function verificationBadge(status: VerificationStatus) {
  const variants: Record<
    VerificationStatus,
    { label: string; className: string }
  > = {
    VERIFIED: {
      label: "Verified",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    },
    PENDING: {
      label: "Pending",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    },
    UNVERIFIED: {
      label: "Unverified",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    },
    REJECTED: {
      label: "Rejected",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    },
  }
  const v = variants[status]
  return <Badge className={v.className}>{v.label}</Badge>
}

function statusBadge(status: HospitalStatus) {
  const variants: Record<HospitalStatus, { label: string; className: string }> =
    {
      ACTIVE: {
        label: "Active",
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      },
      INACTIVE: {
        label: "Inactive",
        className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      },
      SUSPENDED: {
        label: "Suspended",
        className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      },
      UNKNOWN: {
        label: "Unknown",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
      },
    }
  const v = variants[status]
  return <Badge className={v.className}>{v.label}</Badge>
}

export function HospitalProfile({ hospital }: HospitalProfileProps) {
  const location = hospital.location as Record<string, string> | null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{hospital.name}</CardTitle>
            <CardDescription>{hospital.facilityIdentifier}</CardDescription>
          </div>
          <div className="flex gap-2">
            {verificationBadge(hospital.verificationStatus)}
            {statusBadge(hospital.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hospital.type ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Facility Type
            </p>
            <p className="text-sm">
              {hospital.type.replace(/_/g, " ")}
            </p>
          </div>
        ) : null}

        {location ? (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
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
  )
}
