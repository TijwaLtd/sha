import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface HospitalServicesProps {
  services: {
    service: {
      code: string
      name: string
      category: string | null
    }
  }[]
}

export function HospitalServices({ services }: HospitalServicesProps) {
  if (services.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Available Services</CardTitle>
          <CardDescription>Services this facility is registered to provide</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No services registered.</p>
        </CardContent>
      </Card>
    )
  }

  const grouped = services.reduce(
    (acc, hs) => {
      const cat = hs.service.category || "Other"
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(hs.service)
      return acc
    },
    {} as Record<string, typeof services[number]["service"][]>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Services</CardTitle>
        <CardDescription>
          {services.length} service{services.length !== 1 ? "s" : ""} registered
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {category.replace(/_/g, " ")}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((s) => (
                <Badge key={s.code} variant="secondary">
                  {s.name}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
