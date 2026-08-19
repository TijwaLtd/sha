"use server"

import { redirect } from "next/navigation"
import bcrypt from "bcryptjs"
import { createDbClient } from "@/lib/db"
import { createSession } from "@/lib/auth/session"

export interface LoginState {
  errors?: {
    email?: string[]
    password?: string[]
  }
  message?: string
}

export async function login(
  _prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return {
      errors: {
        email: !email ? ["Email is required"] : undefined,
        password: !password ? ["Password is required"] : undefined,
      },
    }
  }

  const db = createDbClient()
  const user = await db.user.findUnique({
    where: { email },
  })

  if (!user) {
    return { message: "Invalid email or password" }
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash)

  if (!passwordValid) {
    return { message: "Invalid email or password" }
  }

  await createSession(user.id, user.role, user.hospitalId)

  // Redirect based on role
  if (user.role === "HOSPITAL_USER") {
    redirect("/hospital")
  } else {
    redirect("/sha")
  }
}
