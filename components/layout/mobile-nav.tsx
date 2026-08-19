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

interface MobileNavProps {
  items: NavItem[]
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = iconMap[item.icon]

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                {Icon ? <Icon className="h-5 w-5" /> : null}
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
