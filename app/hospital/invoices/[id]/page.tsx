import Link from "next/link"
import { requireAuth } from "@/lib/auth/dal"
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
import { InvoiceItemForm } from "./_components/invoice-item-form"
import { ClaimItemsList } from "./_components/claim-items-list"
import { SubmitConfirmation } from "./_components/submit-confirmation"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  SUBMITTED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  RECEIVED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireAuth()

  const db = createDbClient()
  const claim = await db.claim.findUnique({
    where: { id },
    include: {
      items: {
        include: { service: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!claim || claim.hospitalId !== user.hospitalId) {
    notFound()
  }

  const services = await db.service.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })

  const isDraft = claim.status === "DRAFT"
  const isSubmitted = ["SUBMITTED", "RECEIVED", "VALIDATING", "ANALYZING", "ASSESSED"].includes(claim.status)

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/hospital/invoices"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{claim.reference}</h1>
            <p className="text-sm text-muted-foreground">
              {claim.patientReference}
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

        {claim.diagnosis ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{claim.diagnosis}</p>
            </CardContent>
          </Card>
        ) : null}

        {isSubmitted ? (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center gap-3 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium">
                    Claim has been submitted
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {claim.submittedAt
                      ? `Submitted on ${new Date(claim.submittedAt).toLocaleDateString("en-KE")}`
                      : "Awaiting processing"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Claim Items</CardTitle>
                <CardDescription>
                  {claim.items.length} item
                  {claim.items.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ClaimItemsList items={claim.items} claimStatus={claim.status} />

            {isDraft ? (
              <>
                <Separator />
                <InvoiceItemForm claimId={claim.id} services={services} />
              </>
            ) : null}
          </CardContent>
        </Card>

        {isDraft && claim.items.length > 0 ? (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-lg font-semibold">
                    {formatKES(claim.totalAmountCents)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <SubmitConfirmation
              claimId={claim.id}
              reference={claim.reference}
              patientReference={claim.patientReference}
              itemCount={claim.items.length}
              totalAmountCents={claim.totalAmountCents}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
