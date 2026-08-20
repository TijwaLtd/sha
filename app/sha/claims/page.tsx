import Link from "next/link"
import { Suspense } from "react"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { formatKES } from "@/lib/money"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ClaimFilter } from "./_components/claim-filter"

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

interface ClaimsPageProps {
  searchParams: Promise<{
    hospitalId?: string
  }>
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {
    status: {
      in: ["RECEIVED", "VALIDATING", "ANALYZING", "ASSESSED"],
    },
  }

  if (params.hospitalId) {
    where.hospitalId = params.hospitalId
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

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Incoming Claims</h1>
          <p className="text-sm text-muted-foreground">
            {claims.length} claim{claims.length !== 1 ? "s" : ""} in processing queue
          </p>
        </div>

        <Suspense fallback={<div>Loading filter...</div>}>
          <ClaimFilter hospitals={hospitals} />
        </Suspense>

        {claims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No claims in the processing queue.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <Link key={claim.id} href={`/sha/claims/${claim.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {claim.reference}
                        </CardTitle>
                        <CardDescription>
                          {claim.hospital.name} • {claim.hospital.facilityIdentifier}
                        </CardDescription>
                      </div>
                      <Badge
                        className={
                          statusColors[claim.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {claim._count.items} item
                        {claim._count.items !== 1 ? "s" : ""} •{" "}
                        {claim.submittedAt
                          ? new Date(claim.submittedAt).toLocaleDateString("en-KE")
                          : "No date"}
                      </span>
                      <span className="font-medium">
                        {formatKES(claim.totalAmountCents)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
