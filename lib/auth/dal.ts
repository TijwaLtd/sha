import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { getSession } from "./session"
import { createDbClient } from "@/lib/db"
import type { UserRole } from "@/app/generated/prisma/enums"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  hospitalId: string | null
}

export const verifySession = cache(async () => {
  const session = await getSession()

  if (!session?.userId) {
    redirect("/login")
  }

  return {
    isAuth: true,
    userId: session.userId,
    role: session.role,
    hospitalId: session.hospitalId,
  }
})

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession()

  if (!session?.userId) {
    return null
  }

  const db = createDbClient()
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hospitalId: true,
    },
  })

  return user
})

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await requireAuth()

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized")
  }

  return user
}
