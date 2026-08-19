"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth/dal"
import { createDbClient } from "@/lib/db"

interface VerifyHospitalInput {
  hospitalId: string
  status: string
}

export async function verifyHospital(input: VerifyHospitalInput) {
  const user = await requireRole(["SHA_OFFICER", "ADMIN"])

  const validStatuses = ["VERIFIED", "PENDING", "UNVERIFIED", "REJECTED"]
  if (!validStatuses.includes(input.status)) {
    return { success: false, error: "Invalid verification status" }
  }

  const db = createDbClient()

  const hospital = await db.hospital.findUnique({
    where: { id: input.hospitalId },
  })

  if (!hospital) {
    return { success: false, error: "Hospital not found" }
  }

  const previousStatus = hospital.verificationStatus

  await db.hospital.update({
    where: { id: input.hospitalId },
    data: { verificationStatus: input.status as "VERIFIED" | "PENDING" | "UNVERIFIED" | "REJECTED" },
  })

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "HOSPITAL_VERIFICATION_CHANGED",
      entityType: "Hospital",
      entityId: input.hospitalId,
      metadata: {
        previousStatus,
        newStatus: input.status,
      },
    },
  })

  revalidatePath(`/sha/hospitals/${input.hospitalId}`)
  revalidatePath("/sha/hospitals")

  return { success: true }
}
