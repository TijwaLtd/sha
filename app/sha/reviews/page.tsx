import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { ReviewListing } from "./_components/review-listing"

const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED"]
const OUTCOME_OPTIONS = [
  "CLEARED",
  "CONFIRMED_ANOMALY",
  "REJECTED_CLAIM",
  "ESCALATED",
  "NEEDS_MORE_INFORMATION",
]

interface ReviewsPageProps {
  searchParams: Promise<{
    status?: string
    outcome?: string
    q?: string
  }>
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  await requireRole(["SHA_OFFICER", "ADMIN"])

  const params = await searchParams
  const db = createDbClient()

  const where: Record<string, unknown> = {}
  if (params.status && STATUS_OPTIONS.includes(params.status))
    where.status = params.status
  if (params.outcome && OUTCOME_OPTIONS.includes(params.outcome))
    where.outcome = params.outcome

  const reviews = await db.review.findMany({
    where,
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
      actions: { select: { id: true } },
    },
  })

  const rows = reviews.map((review) => ({
    id: review.id,
    status: review.status,
    outcome: review.outcome,
    notes: review.notes,
    createdAt: review.createdAt.toISOString(),
    claim: {
      id: review.claim.id,
      reference: review.claim.reference,
      totalAmountCents: review.claim.totalAmountCents,
      claimStatus: review.claim.status,
      hospitalName: review.claim.hospital?.name ?? null,
    },
    reviewerName: review.reviewer.name,
    actionCount: review.actions.length,
  }))

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <ReviewListing
          reviews={rows}
          currentFilters={{
            status: params.status || "",
            outcome: params.outcome || "",
            q: params.q || "",
          }}
        />
      </div>
    </div>
  )
}