"use client"

import { useTransition } from "react"
import { verifyHospital } from "../_actions/verification-actions"

interface VerificationPanelProps {
  hospitalId: string
  currentStatus: string
  hasServices: boolean
  isActive: boolean
  isRegistered: boolean
}

export function VerificationPanel({
  hospitalId,
  currentStatus,
  hasServices,
  isActive,
  isRegistered,
}: VerificationPanelProps) {
  const [isPending, startTransition] = useTransition()

  function handleVerify(status: string) {
    startTransition(async () => {
      await verifyHospital({ hospitalId, status })
      window.location.reload()
    })
  }

  const checks = [
    { label: "Registered", met: isRegistered },
    { label: "Active", met: isActive },
    { label: "Has declared services", met: hasServices },
  ]

  const checksPassed = checks.filter((c) => c.met).length

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Verification Checks</p>
        <div className="space-y-1">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2 text-sm">
              <span
                className={
                  check.met
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {check.met ? "✓" : "✗"}
              </span>
              <span>{check.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {checksPassed} of {checks.length} checks passed
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Set Verification Status</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleVerify("VERIFIED")}
            disabled={isPending || currentStatus === "VERIFIED"}
            className="inline-flex h-8 items-center justify-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => handleVerify("PENDING")}
            disabled={isPending || currentStatus === "PENDING"}
            className="inline-flex h-8 items-center justify-center rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-yellow-700 disabled:pointer-events-none disabled:opacity-50"
          >
            Set Pending
          </button>
          <button
            type="button"
            onClick={() => handleVerify("REJECTED")}
            disabled={isPending || currentStatus === "REJECTED"}
            className="inline-flex h-8 items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
