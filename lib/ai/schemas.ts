import { z } from "zod"

export const AiFindingSchema = z.object({
  category: z.enum([
    "FACILITY_CONCERN",
    "SERVICE_MISMATCH",
    "AMOUNT_ANOMALY",
    "QUANTITY_ANOMALY",
    "DIAGNOSIS_MISMATCH",
    "DOCUMENTATION_GAP",
    "SERVICE_RELEVANCE",
    "PATTERN_ANOMALY",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  confidence: z.number().min(0).max(1),
  description: z.string().min(1),
  reasoning: z.string().min(1),
})

export const AiAnalysisResponseSchema = z.object({
  assessment: z.enum([
    "LOW_RISK",
    "MODERATE_RISK",
    "HIGH_RISK",
    "CRITICAL_RISK",
  ]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  findings: z.array(AiFindingSchema).default([]),
  riskScore: z.number().min(0).max(100),
})

export type AiFindingInput = z.infer<typeof AiFindingSchema>
export type AiAnalysisResponse = z.infer<typeof AiAnalysisResponseSchema>

export interface ClaimContext {
  claimId: string
  reference: string
  hospitalName: string
  hospitalStatus: string
  verificationStatus: string
  diagnosis: string | null
  totalAmountCents: number
  items: Array<{
    description: string | null
    quantity: number
    unitPriceCents: number
    serviceCode: string
  }>
  hospitalServices: string[]
  previousClaims: number
  complianceRuleHits: Array<{
    ruleCode: string
    ruleName: string
    triggered: boolean
    severity: string
  }>
}
