import type { ReactNode } from "react"
import { requireAuth } from "@/lib/auth/dal"
import { AppShell } from "@/components/layout/app-shell"
import { shaNav } from "@/components/layout/sha-nav"

export default async function ShaLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireAuth()

  return (
    <AppShell user={user} config={shaNav}>
      {children}
    </AppShell>
  )
}
