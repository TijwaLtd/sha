import Link from "next/link"
import { requireAuth } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
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
import { Plus } from "lucide-react"

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
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

export default async function InvoicesPage() {
  const user = await requireAuth()

  const db = createDbClient()
  const claims = await db.claim.findMany({
    where: { hospitalId: user.hospitalId! },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
    },
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage claim invoices
            </p>
          </div>
          <Link
            href="/hospital/invoices/new"
            className={buttonVariants({ variant: "default" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </div>

        {claims.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No invoices yet.</p>
              <Link
                href="/hospital/invoices/new"
                className={buttonVariants({ variant: "default", className: "mt-4" })}
              >
                Create your first invoice
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {claims.map((claim) => (
              <Link key={claim.id} href={`/hospital/invoices/${claim.id}`}>
                <Card className="transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {claim.reference}
                        </CardTitle>
                        <CardDescription>
                          {claim.patientReference}
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
                        {claim._count.items !== 1 ? "s" : ""}
                      </span>
                      <span className="font-medium">
                        {formatKES(claim.totalAmountCents)}
                      </span>
                    </div>
                    {claim.diagnosis ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {claim.diagnosis}
                      </p>
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
