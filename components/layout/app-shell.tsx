import type { ReactNode } from "react"
import type { AuthUser } from "@/lib/auth/dal"
import type { PortalConfig } from "./types"
import { AppHeader } from "./app-header"
import { SidebarNav } from "./sidebar-nav"
import { MobileNav } from "./mobile-nav"

interface AppShellProps {
  user: AuthUser
  config: PortalConfig
  children: ReactNode
}

export function AppShell({ user, config, children }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <SidebarNav items={config.items} portalName={config.name} />

      {/* Mobile + Desktop main area */}
      <div className="flex flex-1 flex-col">
        <AppHeader user={user} portalName={config.name} />

        <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <MobileNav items={config.items} />
      </div>
    </div>
  )
}
