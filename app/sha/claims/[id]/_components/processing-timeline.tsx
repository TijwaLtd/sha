"use client"

import { useTransition } from "react"
import { processClaim } from "../_actions/process-claim"

interface ProcessingTimelineProps {
  claimId: string
  currentStatus: string
}

const steps = [
  { key: "RECEIVED", label: "Claim received" },
  { key: "VALIDATING", label: "Facility verification" },
  { key: "ANALYZING", label: "Compliance checks" },
  { key: "ASSESSED", label: "Risk assessment" },
  { key: "CLEARED", label: "Completed" },
]

export function ProcessingTimeline({
  claimId,
  currentStatus,
}: ProcessingTimelineProps) {
  const [isPending, startTransition] = useTransition()

  function handleProcess() {
    startTransition(async () => {
      await processClaim({ claimId })
      window.location.reload()
    })
  }

  const currentIdx = steps.findIndex((s) => s.key === currentStatus)
  const isTerminal = ["CLEARED", "FLAGGED"].includes(currentStatus)

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isComplete = currentIdx >= idx
          const isCurrent = currentIdx === idx

          return (
            <div key={step.key} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  isComplete
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {isComplete ? "✓" : idx + 1}
              </div>
              <span
                className={`text-sm ${
                  isCurrent
                    ? "font-medium"
                    : isComplete
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {step.label}
              </span>
              {isCurrent && !isTerminal ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  Current
                </span>
              ) : null}
            </div>
          )
        })}
      </div>

      {currentStatus === "FLAGGED" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Claim flagged for review
          </p>
          <p className="text-xs text-red-600 dark:text-red-300">
            This claim requires investigation by an SHA officer.
          </p>
        </div>
      ) : null}

      {!isTerminal ? (
        <button
          type="button"
          onClick={handleProcess}
          disabled={isPending}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {isPending
            ? "Processing..."
            : currentStatus === "RECEIVED"
              ? "Start Processing"
              : "Advance Processing"}
        </button>
      ) : null}
    </div>
  )
}
