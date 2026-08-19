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
import { ProcessingTimeline } from "./_components/processing-timeline"

const statusColors: Record<string, string> = {
  RECEIVED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  VALIDATING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  ANALYZING:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  ASSESSED:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  CLEARED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FLAGGED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()
  const claim = await db.claim.findUnique({
    where: { id },
    include: {
      hospital: {
        select: {
          name: true,
          facilityIdentifier: true,
          verificationStatus: true,
          status: true,
        },
      },
      items: {
        include: { service: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!claim) {
    notFound()
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/sha/claims"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{claim.reference}</h1>
            <p className="text-sm text-muted-foreground">
              {claim.hospital.name} • {claim.hospital.facilityIdentifier}
            </p>
          </div>
          <Badge
            className={
              statusColors[claim.status] || "bg-gray-100 text-gray-800"
            }
          >
            {claim.status.replace(/_/g, " ")}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Patient Reference
                </p>
                <p>{claim.patientReference}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Submitted
                </p>
                <p>
                  {claim.submittedAt
                    ? new Date(claim.submittedAt).toLocaleDateString("en-KE")
                    : "Not submitted"}
                </p>
              </div>
            </div>
            {claim.diagnosis ? (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Diagnosis
                  </p>
                  <p className="text-sm">{claim.diagnosis}</p>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Facility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{claim.hospital.name}</p>
                <p className="text-xs text-muted-foreground">
                  {claim.hospital.facilityIdentifier}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">
                  {claim.hospital.verificationStatus}
                </Badge>
                <Badge variant="secondary">
                  {claim.hospital.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing</CardTitle>
            <CardDescription>
              Claim processing pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProcessingTimeline
              claimId={claim.id}
              currentStatus={claim.status}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Items</CardTitle>
            <CardDescription>
              {claim.items.length} item{claim.items.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {claim.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.service.name}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatKES(item.unitAmountCents)}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {formatKES(item.totalAmountCents)}
                  </span>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-lg font-semibold">
                {formatKES(claim.totalAmountCents)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
