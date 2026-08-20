"use client"

import { useRouter, useSearchParams } from "next/navigation"

interface Hospital {
  id: string
  name: string
  facilityIdentifier: string
}

interface ClaimFilterProps {
  hospitals: Hospital[]
}

export function ClaimFilter({ hospitals }: ClaimFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("hospitalId", value)
    } else {
      params.delete("hospitalId")
    }
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="space-y-2">
      <label htmlFor="hospital-filter" className="text-sm font-medium text-muted-foreground">
        Hospital
      </label>
      <select
        id="hospital-filter"
        value={searchParams.get("hospitalId") || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">All Hospitals</option>
        {hospitals.map((hospital) => (
          <option key={hospital.id} value={hospital.id}>
            {hospital.name} ({hospital.facilityIdentifier})
          </option>
        ))}
      </select>
    </div>
  )
}
