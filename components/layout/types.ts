export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
}

export interface PortalConfig {
  name: string
  shortName: string
  items: NavItem[]
}
