import type { PortalConfig } from "./types"

export const shaNav: PortalConfig = {
  name: "SHA Compliance",
  shortName: "SHA",
  items: [
    { label: "Dashboard", href: "/sha", icon: "LayoutDashboard" },
    { label: "Claims", href: "/sha/claims", icon: "FileSearch" },
    { label: "Alerts", href: "/sha/alerts", icon: "AlertTriangle" },
    { label: "Hospitals", href: "/sha/hospitals", icon: "Building2" },
    { label: "Reviews", href: "/sha/reviews", icon: "ClipboardCheck" },
    { label: "More", href: "/sha/more", icon: "MoreHorizontal" },
  ],
}
