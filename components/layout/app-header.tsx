"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AuthUser } from "@/lib/auth/dal"
import { logout } from "./_actions/logout"

interface AppHeaderProps {
  user: AuthUser
  portalName: string
}

export function AppHeader({ user, portalName }: AppHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold md:hidden">{portalName}</span>
        <span className="hidden text-lg font-semibold md:inline">
          {portalName}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-muted-foreground md:inline">
          {user.name}
        </span>
        <form action={logout}>
          <Button variant="ghost" size="icon" type="submit">
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
