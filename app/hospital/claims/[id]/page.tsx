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
import { ArrowLeft, CheckCircle2, Clock, AlertTriangle } from "lucide-react"

const statusColors: Record<string, string> = {
  SUBMITTED:
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
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
  UNDER_REVIEW:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  RESOLVED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
}

function getStatusIcon(status: string) {
  switch (status) {
    case "SUBMITTED":
    case "RECEIVED":
      return <Clock className="h-4 w-4 text-yellow-600" />
    case "VALIDATING":
    case "ANALYZING":
      return <Clock className="h-4 w-4 text-purple-600" />
    case "CLEARED":
    case "RESOLVED":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case "FLAGGED":
    case "UNDER_REVIEW":
      return <AlertTriangle className="h-4 w-4 text-red-600" />
    default:
      return <Clock className="h-4 w-4 text-gray-600" />
  }
}

export default async function ClaimDetailPage({
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

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/hospital/claims"
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {getStatusIcon(claim.status)}
              <div>
                <p className="text-sm font-medium">
                  {claim.status === "SUBMITTED" && "Claim submitted"}
                  {claim.status === "RECEIVED" && "Claim received by SHA"}
                  {claim.status === "VALIDATING" && "Validating claim information"}
                  {claim.status === "ANALYZING" && "Analyzing claim details"}
                  {claim.status === "ASSESSED" && "Claim assessed"}
                  {claim.status === "CLEARED" && "Claim cleared - no issues found"}
                  {claim.status === "FLAGGED" && "Claim flagged for review"}
                  {claim.status === "UNDER_REVIEW" && "Claim under investigation"}
                  {claim.status === "RESOLVED" && "Investigation resolved"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {claim.submittedAt
                    ? `Submitted ${new Date(claim.submittedAt).toLocaleDateString("en-KE")}`
                    : "Awaiting submission"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claim Items</CardTitle>
            <CardDescription>
              {claim.items.length} item{claim.items.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
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
