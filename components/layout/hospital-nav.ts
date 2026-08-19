import type { PortalConfig } from "./types"

export const hospitalNav: PortalConfig = {
  name: "Hospital Portal",
  shortName: "Hospital",
  items: [
    { label: "Home", href: "/hospital", icon: "Home" },
    { label: "Invoices", href: "/hospital/invoices", icon: "FileText" },
    { label: "Claims", href: "/hospital/claims", icon: "Receipt" },
    { label: "Hospital", href: "/hospital/profile", icon: "Building2" },
    { label: "More", href: "/hospital/more", icon: "MoreHorizontal" },
  ],
}
