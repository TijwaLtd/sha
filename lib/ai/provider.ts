import type { AiAnalysisResponse, ClaimContext } from "./schemas"

export interface AiProvider {
  name: string
  analyzeClaim(context: ClaimContext): Promise<AiAnalysisResponse>
}

export type AiProviderName = "groq" | "openrouter" | "mock"

export function getAiProvider(): AiProvider {
  const providerName = (process.env.AI_PROVIDER as AiProviderName) || "mock"

  switch (providerName) {
    case "groq":
      return createGroqProvider()
    case "openrouter":
      return createOpenRouterProvider()
    case "mock":
    default:
      return createMockProvider()
  }
}

function createGroqProvider(): AiProvider {
  const apiKey = process.env.GROQ_API_KEY
  const model =
    process.env.GROQ_MODEL || "llama-3.1-70b-versatile"

  if (!apiKey) {
    console.warn("GROQ_API_KEY not set, falling back to mock provider")
    return createMockProvider()
  }

  return {
    name: "groq",
    async analyzeClaim(context: ClaimContext) {
      const prompt = buildAnalysisPrompt(context)
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error("Empty response from Groq")

      return JSON.parse(content) as AiAnalysisResponse
    },
  }
}

function createOpenRouterProvider(): AiProvider {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model =
    process.env.OPENROUTER_MODEL || "anthropic/claude-3-haiku"

  if (!apiKey) {
    console.warn(
      "OPENROUTER_API_KEY not set, falling back to mock provider"
    )
    return createMockProvider()
  }

  return {
    name: "openrouter",
    async analyzeClaim(context: ClaimContext) {
      const prompt = buildAnalysisPrompt(context)
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://sha-compliance.demo",
            "X-Title": "SHA Compliance Platform",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error("Empty response from OpenRouter")

      return JSON.parse(content) as AiAnalysisResponse
    },
  }
}

function createMockProvider(): AiProvider {
  return {
    name: "mock",
    async analyzeClaim(context: ClaimContext) {
      await new Promise((r) => setTimeout(r, 500))

      const findings: AiAnalysisResponse["findings"] = []

      if (
        context.hospitalStatus === "SUSPENDED" ||
        context.hospitalStatus === "INACTIVE"
      ) {
        findings.push({
          category: "FACILITY_CONCERN",
          severity: "HIGH",
          confidence: 0.9,
          description: `Hospital status is ${context.hospitalStatus.toLowerCase()}`,
          reasoning:
            "Claims from inactive or suspended facilities require investigation",
        })
      }

      if (
        context.verificationStatus !== "VERIFIED"
      ) {
        findings.push({
          category: "FACILITY_CONCERN",
          severity: "MEDIUM",
          confidence: 0.85,
          description: `Facility verification status: ${context.verificationStatus.toLowerCase()}`,
          reasoning: "Unverified facilities may not meet compliance standards",
        })
      }

      const serviceCodes = context.hospitalServices
      for (const item of context.items) {
        if (!serviceCodes.includes(item.serviceCode)) {
          findings.push({
            category: "SERVICE_MISMATCH",
            severity: "HIGH",
            confidence: 0.8,
            description: `Service ${item.serviceCode} not in hospital's approved services`,
            reasoning: `Hospital does not offer ${item.serviceCode} but billed for it`,
          })
        }
      }

      if (context.totalAmountCents > 500000) {
        findings.push({
          category: "AMOUNT_ANOMALY",
          severity: "MEDIUM",
          confidence: 0.7,
          description: `Claim total KES ${(context.totalAmountCents / 100).toFixed(0)} exceeds typical range`,
          reasoning: "Amount is significantly higher than average for this facility",
        })
      }

      for (const item of context.items) {
        if (item.quantity > 10) {
          findings.push({
            category: "QUANTITY_ANOMALY",
            severity: "MEDIUM",
            confidence: 0.75,
            description: `Unusual quantity ${item.quantity} for ${item.serviceCode}`,
            reasoning: "Quantity exceeds normal treatment protocols",
          })
        }
      }

      const ruleHits = context.complianceRuleHits.filter(
        (r) => r.triggered
      )
      for (const hit of ruleHits) {
        findings.push({
          category: "PATTERN_ANOMALY",
          severity: hit.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          confidence: 0.85,
          description: `Compliance rule ${hit.ruleCode} triggered: ${hit.ruleName}`,
          reasoning: `Automated rule evaluation flagged this claim`,
        })
      }

      let riskScore = 10
      for (const f of findings) {
        const weight =
          f.severity === "CRITICAL"
            ? 25
            : f.severity === "HIGH"
              ? 15
              : f.severity === "MEDIUM"
                ? 10
                : 5
        riskScore += Math.round(weight * f.confidence)
      }
      riskScore = Math.min(riskScore, 100)

      const assessment =
        riskScore >= 75
          ? "CRITICAL_RISK"
          : riskScore >= 50
            ? "HIGH_RISK"
            : riskScore >= 25
              ? "MODERATE_RISK"
              : "LOW_RISK"

      return {
        assessment,
        confidence: findings.length > 0 ? 0.8 : 0.6,
        summary:
          findings.length > 0
            ? `Identified ${findings.length} potential compliance concern(s)`
            : "No significant compliance concerns identified",
        findings,
        riskScore,
      }
    },
  }
}

const SYSTEM_PROMPT = `You are a healthcare claims compliance analyzer for Kenya's Social Health Authority (SHA).
Analyze claims for potential compliance issues including: facility verification, service authorization, billing accuracy, diagnosis consistency, and fraud indicators.

Return a JSON object with:
- assessment: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK"
- confidence: 0.0-1.0
- summary: brief explanation
- findings: array of {category, severity, confidence, description, reasoning}
- riskScore: 0-100

Categories: FACILITY_CONCERN, SERVICE_MISMATCH, AMOUNT_ANOMALY, QUANTITY_ANOMALY, DIAGNOSIS_MISMATCH, DOCUMENTATION_GAP, SERVICE_RELEVANCE, PATTERN_ANOMALY
Severities: LOW, MEDIUM, HIGH, CRITICAL

Be thorough but avoid false positives. Consider the full context of the claim.`

function buildAnalysisPrompt(context: ClaimContext): string {
  const items = context.items
    .map(
      (i) =>
        `- ${i.serviceCode}: ${i.description} | Qty: ${i.quantity} | Unit: KES ${(i.unitPriceCents / 100).toFixed(0)}`
    )
    .join("\n")

  const ruleHits = context.complianceRuleHits
    .filter((r) => r.triggered)
    .map((r) => `- ${r.ruleCode}: ${r.ruleName} (${r.severity})`)
    .join("\n")

  return `Analyze this healthcare claim for compliance issues:

CLAIM: ${context.reference}
HOSPITAL: ${context.hospitalName} (Status: ${context.hospitalStatus}, Verification: ${context.verificationStatus})
DIAGNOSIS: ${context.diagnosis || "Not specified"}
TOTAL: KES ${(context.totalAmountCents / 100).toFixed(0)}
PREVIOUS CLAIMS FROM HOSPITAL: ${context.previousClaims}

APPROVED SERVICES: ${context.hospitalServices.join(", ") || "None"}

LINE ITEMS:
${items || "None"}

COMPLIANCE RULE HITS:
${ruleHits || "None"}

Provide your analysis as JSON.`
}
