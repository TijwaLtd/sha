"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"

export async function acknowledgeAlert(alertId: string) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])
  const db = createDbClient()

  const alert = await db.alert.findUnique({ where: { id: alertId } })
  if (!alert) return { success: false, error: "Alert not found" }
  if (alert.status !== "OPEN") return { success: false, error: "Alert already actioned" }

  await db.alert.update({
    where: { id: alertId },
    data: { status: "ACKNOWLEDGED" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ALERT_ACKNOWLEDGED",
      entityType: "Alert",
      entityId: alertId,
      metadata: { claimId: alert.claimId },
    },
  })

  revalidatePath("/sha/alerts")
  return { success: true }
}

export async function startReview(alertId: string) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])
  const db = createDbClient()

  const alert = await db.alert.findUnique({ where: { id: alertId } })
  if (!alert) return { success: false, error: "Alert not found" }
  if (alert.status === "UNDER_REVIEW") return { success: false, error: "Already under review" }
  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
    return { success: false, error: "Alert already closed" }
  }

  await db.alert.update({
    where: { id: alertId },
    data: { status: "UNDER_REVIEW" },
  })

  if (alert.claimId) {
    await db.claim.update({
      where: { id: alert.claimId },
      data: { status: "UNDER_REVIEW" },
    })
  }

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ALERT_UNDER_REVIEW",
      entityType: "Alert",
      entityId: alertId,
      metadata: { claimId: alert.claimId },
    },
  })

  revalidatePath("/sha/alerts")
  revalidatePath(`/sha/claims/${alert.claimId}`)
  return { success: true }
}

export async function resolveAlert(alertId: string, notes?: string) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])
  const db = createDbClient()

  const alert = await db.alert.findUnique({ where: { id: alertId } })
  if (!alert) return { success: false, error: "Alert not found" }
  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
    return { success: false, error: "Alert already closed" }
  }

  await db.alert.update({
    where: { id: alertId },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedById: user.id,
      metadata: {
        ...(alert.metadata as Record<string, unknown>),
        resolutionNotes: notes,
      },
    },
  })

  if (alert.claimId) {
    const claim = await db.claim.findUnique({ where: { id: alert.claimId } })
    if (claim && (claim.status === "UNDER_REVIEW" || claim.status === "FLAGGED")) {
      await db.claim.update({
        where: { id: alert.claimId },
        data: { status: "RESOLVED" },
      })
    }
  }

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ALERT_RESOLVED",
      entityType: "Alert",
      entityId: alertId,
      metadata: { claimId: alert.claimId, notes },
    },
  })

  revalidatePath("/sha/alerts")
  revalidatePath("/sha/claims")
  revalidatePath(`/sha/claims/${alert.claimId}`)
  return { success: true }
}

export async function dismissAlert(alertId: string, reason?: string) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])
  const db = createDbClient()

  const alert = await db.alert.findUnique({ where: { id: alertId } })
  if (!alert) return { success: false, error: "Alert not found" }
  if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
    return { success: false, error: "Alert already closed" }
  }

  await db.alert.update({
    where: { id: alertId },
    data: {
      status: "DISMISSED",
      resolvedAt: new Date(),
      resolvedById: user.id,
      metadata: {
        ...(alert.metadata as Record<string, unknown>),
        dismissalReason: reason,
      },
    },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "ALERT_DISMISSED",
      entityType: "Alert",
      entityId: alertId,
      metadata: { claimId: alert.claimId, reason },
    },
  })

  revalidatePath("/sha/alerts")
  return { success: true }
}
