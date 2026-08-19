"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { submitClaim } from "../../_actions/invoice-actions"
import { formatKES } from "@/lib/money"

interface SubmitConfirmationProps {
  claimId: string
  reference: string
  patientReference: string
  itemCount: number
  totalAmountCents: number
}

export function SubmitConfirmation({
  claimId,
  reference,
  patientReference,
  itemCount,
  totalAmountCents,
}: SubmitConfirmationProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitClaim({ claimId })
      if (result.success) {
        router.refresh()
      }
    })
  }

  return (
    <div className="rounded-md border bg-muted/50 p-4 space-y-3">
      <p className="text-sm font-medium">Ready to submit?</p>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Reference: {reference}</p>
        <p>Patient: {patientReference}</p>
        <p>
          {itemCount} item{itemCount !== 1 ? "s" : ""} — {formatKES(totalAmountCents)}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Submit to SHA"}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        After submission, this claim cannot be edited.
      </p>
    </div>
  )
}
