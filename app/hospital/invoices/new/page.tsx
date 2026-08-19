import { requireAuth } from "@/lib/auth/dal"
import { InvoiceForm } from "./_components/invoice-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function NewInvoicePage() {
  const user = await requireAuth()

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>New Invoice</CardTitle>
            <CardDescription>
              Create a draft invoice to add claim items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceForm hospitalId={user.hospitalId!} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
