"use client"

import { useTransition } from "react"
import { removeItemFromClaim } from "../../_actions/invoice-actions"
import { formatKES } from "@/lib/money"

interface ClaimItemsListProps {
  items: {
    id: string
    description: string | null
    quantity: number
    unitAmountCents: number
    totalAmountCents: number
    service: { name: string; code: string }
  }[]
  claimStatus: string
}

export function ClaimItemsList({ items, claimStatus }: ClaimItemsListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No items added yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ClaimItemRow
          key={item.id}
          item={item}
          isDraft={claimStatus === "DRAFT"}
        />
      ))}
    </div>
  )
}

function ClaimItemRow({
  item,
  isDraft,
}: {
  item: ClaimItemsListProps["items"][number]
  isDraft: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleRemove() {
    startTransition(async () => {
      await removeItemFromClaim({ itemId: item.id })
      window.location.reload()
    })
  }

  return (
    <div className="flex items-start justify-between rounded-md border p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{item.service.name}</p>
        {item.description ? (
          <p className="text-xs text-muted-foreground">{item.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {item.quantity} × {formatKES(item.unitAmountCents)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {formatKES(item.totalAmountCents)}
        </span>
        {isDraft ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="text-xs text-destructive hover:underline disabled:opacity-50"
          >
            {isPending ? "..." : "Remove"}
          </button>
        ) : null}
      </div>
    </div>
  )
}
