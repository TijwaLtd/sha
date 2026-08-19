import Link from "next/link"
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
import { ClipboardCheck } from "lucide-react"

const statusColors: Record<string, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  IN_PROGRESS:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
}

const outcomeColors: Record<string, string> = {
  CLEARED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CONFIRMED_ANOMALY:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  REJECTED_CLAIM:
    "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  ESCALATED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  NEEDS_MORE_INFORMATION:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
}

export default async function ReviewsPage() {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const db = createDbClient()

  const reviews = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      claim: {
        select: {
          id: true,
          reference: true,
          totalAmountCents: true,
          status: true,
          hospital: { select: { name: true } },
        },
      },
      reviewer: { select: { name: true } },
      actions: { orderBy: { performedAt: "asc" } },
    },
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            {reviews.length} investigation{reviews.length !== 1 ? "s" : ""}
          </p>
        </div>

        {reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">
                No investigations yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Link key={review.id} href={`/sha/claims/${review.claim.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {review.claim.reference}
                        </CardTitle>
                        <CardDescription>
                          {review.claim.hospital.name} • Investigator:{" "}
                          {review.reviewer.name}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.outcome ? (
                          <Badge
                            className={
                              outcomeColors[review.outcome] ||
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {review.outcome.replace(/_/g, " ")}
                          </Badge>
                        ) : null}
                        <Badge
                          className={
                            statusColors[review.status] ||
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {review.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatKES(review.claim.totalAmountCents)} • Claim
                        status:{" "}
                        {review.claim.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {review.notes ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {review.notes}
                      </p>
                    ) : null}
                    {review.actions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {review.actions.map((action) => (
                          <Badge
                            key={action.id}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {action.action.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
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
