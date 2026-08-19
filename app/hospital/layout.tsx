import type { ReactNode } from "react"
import { requireAuth } from "@/lib/auth/dal"
import { AppShell } from "@/components/layout/app-shell"
import { hospitalNav } from "@/components/layout/hospital-nav"

export default async function HospitalLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireAuth()

  return (
    <AppShell user={user} config={hospitalNav}>
      {children}
    </AppShell>
  )
}
