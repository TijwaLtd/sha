"use client"

import { useTransition } from "react"
import { addItemToClaim } from "../../_actions/invoice-actions"
import type { Service } from "@/app/generated/prisma/client"

interface InvoiceItemFormProps {
  claimId: string
  services: Service[]
}

export function InvoiceItemForm({ claimId, services }: InvoiceItemFormProps) {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const result = await addItemToClaim({
        claimId,
        serviceId: formData.get("serviceId") as string,
        description: formData.get("description") as string,
        quantity: Number(formData.get("quantity")),
        unitAmountKES: Number(formData.get("unitAmount")),
      })

      if (result.success) {
        form.reset()
        window.location.reload()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium">Add Item</p>

      <div className="space-y-2">
        <label htmlFor="serviceId" className="text-xs font-medium">
          Service *
        </label>
        <select
          id="serviceId"
          name="serviceId"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Select a service</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-xs font-medium">
          Description
        </label>
        <input
          id="description"
          name="description"
          placeholder="Optional description"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label htmlFor="quantity" className="text-xs font-medium">
            Quantity *
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="unitAmount" className="text-xs font-medium">
            Unit Amount (KES) *
          </label>
          <input
            id="unitAmount"
            name="unitAmount"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="0.00"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add Item"}
      </button>
    </form>
  )
}
