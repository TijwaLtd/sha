"use client"

import {
  Home,
  FileText,
  Receipt,
  Building2,
  MoreHorizontal,
  LayoutDashboard,
  FileSearch,
  AlertTriangle,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { NavItem } from "./types"

const iconMap: Record<string, LucideIcon> = {
  Home,
  FileText,
  Receipt,
  Building2,
  MoreHorizontal,
  LayoutDashboard,
  FileSearch,
  AlertTriangle,
  ClipboardCheck,
}

interface SidebarNavProps {
  items: NavItem[]
  portalName: string
}

export function SidebarNav({ items, portalName }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 flex-col border-r bg-card md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="text-lg font-semibold">
          {portalName}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = iconMap[item.icon]

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {item.label}
              {item.badge && item.badge > 0 ? (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
