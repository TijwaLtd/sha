import "server-only"
import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"
import type { UserRole } from "@/app/generated/prisma/enums"

const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export interface SessionPayload {
  userId: string
  role: UserRole
  hospitalId: string | null
  expiresAt: Date
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({
    userId: payload.userId,
    role: payload.role,
    hospitalId: payload.hospitalId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(
  userId: string,
  role: UserRole,
  hospitalId: string | null
) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const session = await encrypt({ userId, role, hospitalId, expiresAt })
  const cookieStore = await cookies()

  cookieStore.set("session", session, {
    httpOnly: true,
    secure: true,
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("session")?.value
  return decrypt(sessionCookie)
}
