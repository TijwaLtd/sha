"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"
import { toCents } from "@/lib/money"

interface CreateDraftInput {
  hospitalId: string
  patientReference: string
  diagnosis?: string
}

export async function createDraftInvoice(input: CreateDraftInput) {
  const user = await requireRole(["HOSPITAL_USER"])

  if (user.hospitalId !== input.hospitalId) {
    return { success: false, error: "Unauthorized hospital access" }
  }

  if (!input.patientReference || input.patientReference.trim().length === 0) {
    return { success: false, error: "Patient reference is required" }
  }

  const db = createDbClient()

  const year = new Date().getFullYear()
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const reference = `CLM-${year}-${timestamp}${random}`

  const claim = await db.claim.create({
    data: {
      reference,
      hospitalId: input.hospitalId,
      submittedById: user.id,
      patientReference: input.patientReference.trim(),
      diagnosis: input.diagnosis?.trim() || null,
      status: "DRAFT",
      source: "HOSPITAL_PORTAL",
      totalAmountCents: 0,
    },
  })

  revalidatePath("/hospital/invoices")

  return { success: true, claimId: claim.id }
}

interface AddItemInput {
  claimId: string
  serviceId: string
  description?: string
  quantity: number
  unitAmountKES: number
}

export async function addItemToClaim(input: AddItemInput) {
  const user = await requireRole(["HOSPITAL_USER"])

  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: input.claimId },
  })

  if (!claim || claim.hospitalId !== user.hospitalId) {
    return { success: false, error: "Claim not found or unauthorized" }
  }

  if (claim.status !== "DRAFT") {
    return { success: false, error: "Can only add items to draft claims" }
  }

  if (!input.serviceId || input.quantity <= 0 || input.unitAmountKES <= 0) {
    return { success: false, error: "Invalid item data" }
  }

  const unitAmountCents = toCents(input.unitAmountKES)
  const totalAmountCents = unitAmountCents * input.quantity

  await db.claimItem.create({
    data: {
      claimId: input.claimId,
      serviceId: input.serviceId,
      description: input.description?.trim() || null,
      quantity: input.quantity,
      unitAmountCents,
      totalAmountCents,
    },
  })

  const items = await db.claimItem.findMany({
    where: { claimId: input.claimId },
  })
  const newTotal = items.reduce((sum, item) => sum + item.totalAmountCents, 0)

  await db.claim.update({
    where: { id: input.claimId },
    data: { totalAmountCents: newTotal },
  })

  revalidatePath(`/hospital/invoices/${input.claimId}`)
  revalidatePath("/hospital/invoices")

  return { success: true }
}

interface RemoveItemInput {
  itemId: string
}

export async function removeItemFromClaim(input: RemoveItemInput) {
  const user = await requireRole(["HOSPITAL_USER"])

  const db = createDbClient()

  const item = await db.claimItem.findUnique({
    where: { id: input.itemId },
    include: { claim: true },
  })

  if (!item || item.claim.hospitalId !== user.hospitalId) {
    return { success: false, error: "Item not found or unauthorized" }
  }

  if (item.claim.status !== "DRAFT") {
    return { success: false, error: "Can only remove items from draft claims" }
  }

  await db.claimItem.delete({ where: { id: input.itemId } })

  const items = await db.claimItem.findMany({
    where: { claimId: item.claimId },
  })
  const newTotal = items.reduce((sum, i) => sum + i.totalAmountCents, 0)

  await db.claim.update({
    where: { id: item.claimId },
    data: { totalAmountCents: newTotal },
  })

  revalidatePath(`/hospital/invoices/${item.claimId}`)
  revalidatePath("/hospital/invoices")

  return { success: true }
}

interface SubmitClaimInput {
  claimId: string
}

export async function submitClaim(input: SubmitClaimInput) {
  const user = await requireRole(["HOSPITAL_USER"])

  const db = createDbClient()

  const claim = await db.claim.findUnique({
    where: { id: input.claimId },
    include: { items: true },
  })

  if (!claim || claim.hospitalId !== user.hospitalId) {
    return { success: false, error: "Claim not found or unauthorized" }
  }

  if (claim.status !== "DRAFT") {
    return { success: false, error: "Can only submit draft claims" }
  }

  if (claim.items.length === 0) {
    return { success: false, error: "Claim must have at least one item" }
  }

  if (!claim.patientReference || claim.patientReference.trim().length === 0) {
    return { success: false, error: "Patient reference is required" }
  }

  await db.claim.update({
    where: { id: input.claimId },
    data: {
      status: "RECEIVED",
      submittedAt: new Date(),
    },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "CLAIM_SUBMITTED",
      entityType: "Claim",
      entityId: input.claimId,
      metadata: {
        reference: claim.reference,
        totalAmountCents: claim.totalAmountCents,
        itemCount: claim.items.length,
      },
    },
  })

  revalidatePath(`/hospital/invoices/${input.claimId}`)
  revalidatePath("/hospital/invoices")

  return { success: true }
}
