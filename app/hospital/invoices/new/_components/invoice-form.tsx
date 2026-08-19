"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { createDraftInvoice } from "../../_actions/invoice-actions"

interface InvoiceFormProps {
  hospitalId: string
}

export function InvoiceForm({ hospitalId }: InvoiceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createDraftInvoice({
        hospitalId,
        patientReference: formData.get("patientReference") as string,
        diagnosis: formData.get("diagnosis") as string,
      })

      if (result.success && result.claimId) {
        router.push(`/hospital/invoices/${result.claimId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label
          htmlFor="patientReference"
          className="text-sm font-medium leading-none"
        >
          Patient Reference *
        </label>
        <input
          id="patientReference"
          name="patientReference"
          required
          placeholder="e.g. PAT-001"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="diagnosis"
          className="text-sm font-medium leading-none"
        >
          Diagnosis / Context
        </label>
        <textarea
          id="diagnosis"
          name="diagnosis"
          rows={3}
          placeholder="Brief description of the patient condition..."
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Draft Invoice"}
      </button>
    </form>
  )
}
