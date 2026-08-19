# SHA Compliance Platform — Claims Processing Flow

## Overview

The SHA Compliance Platform screens healthcare claims submitted to Kenya's Social Health Authority (SHA). This document explains the complete flow from hospital registration through claim submission, compliance checking, AI analysis, risk scoring, and investigator review.

---

## 1. Hospital Registration & Verification

### 1.1 Hospital Record Creation

When a hospital joins SHA, an administrator creates a `Hospital` record:

```prisma
Hospital {
  facilityIdentifier: String  // Unique ID (e.g., "HOSP-001")
  name: String              // "Nairobi General Hospital"
  type: String?             // "GENERAL", "SPECIALIZED", etc.
  status: HospitalStatus    // ACTIVE | INACTIVE | SUSPENDED | UNKNOWN
  verificationStatus: VerificationStatus  // VERIFIED | UNVERIFIED | PENDING | REJECTED
  location: Json?           // { county, subCounty, ward }
}
```

### 1.2 Service Authorization

Hospitals must be authorized for specific billable services. Each service is a `Service` record:

```prisma
Service {
  code: String    // "MRI", "CONSULTATION", "SURGERY"
  name: String    // "Magnetic Resonance Imaging"
  category: String?  // "RADIOLOGY", "OUTPATIENT", "SURGICAL"
}
```

Authorization is granted via `HospitalService` junction:

```prisma
HospitalService {
  hospitalId: String
  serviceId: String
  // A hospital can only bill for services it's authorized for
}
```

**Example:** Coast Medical Centre is authorized for `CONSULTATION`, `MALARIA_TEST`, `CBC`, `X_RAY`, `EMERGENCY` — but NOT for `MRI`.

### 1.3 Verification Status

| Status | Meaning |
|--------|---------|
| `UNVERIFIED` | New hospital, not yet reviewed |
| `PENDING` | Under review by SHA officer |
| `VERIFIED` | Approved to submit claims |
| `REJECTED` | Failed verification |

**Why it matters:** Claims from `UNVERIFIED` or `PENDING` facilities trigger `R-001: Facility Not Verified` (score: 25).

---

## 2. User Accounts & Authorization

Each hospital user is a `User` bound to one hospital:

```prisma
User {
  email: String     // "billing@nairobigeneral.co.ke"
  role: UserRole    // HOSPITAL_USER | SHA_OFFICER | ADMIN
  hospitalId: String?  // Links user to their hospital
}
```

**Authorization rule:** A hospital user can only create invoices/claims for their own hospital. The `hospitalId` comes from the authenticated user's session, never from the browser.

---

## 3. Invoice Creation (Hospital Portal)

### 3.1 Draft Invoice → Claim

An invoice in the hospital portal IS a `Claim` in `DRAFT` status:

```prisma
Claim {
  reference: String       // "CLM-2026-012" (unique)
  hospitalId: String     // Must match authenticated user's hospital
  submittedById: String?  // User who created the claim
  patientReference: String  // Patient ID (anonymized)
  diagnosis: String?      // ICD code or description
  status: ClaimStatus    // DRAFT initially
  totalAmountCents: Int // Sum of all line items
}
```

### 3.2 Line Items (ClaimItem)

Each service billed is a `ClaimItem`:

```prisma
ClaimItem {
  claimId: String
  serviceId: String       // References the Service
  description: String?    // "MRI Brain with contrast"
  quantity: Int          // Number of units
  unitAmountCents: Int   // Price per unit in KES cents
  totalAmountCents: Int  // quantity × unitAmountCents
}
```

**Claim total** = sum of all `ClaimItem.totalAmountCents`

### 3.3 Adding Items to a Claim

Hospital user calls `addItemToClaim(claimId, serviceId, quantity, unitAmount)`:

1. Verifies user belongs to claim's hospital
2. Verifies claim is in `DRAFT` status
3. Verifies the service is authorized for this hospital
4. Creates `ClaimItem` record

**Service mismatch check:** If the hospital is NOT authorized for the service (no `HospitalService` record), the item is still saved but will trigger a compliance rule later.

---

## 4. Claim Submission

### 4.1 Submitting a Draft

Hospital user calls `submitClaim(claimId)`:

1. Verifies claim is in `DRAFT`
2. Verifies at least one `ClaimItem` exists
3. Sets `status: SUBMITTED` and `submittedAt: now()`

### 4.2 Status Transitions

```
DRAFT → SUBMITTED → RECEIVED → VALIDATING → ANALYZING → ASSESSED → CLEARED
                                                        ↓
                                                      FLAGGED → UNDER_REVIEW → RESOLVED
```

| Status | Who | Meaning |
|--------|-----|---------|
| `DRAFT` | Hospital | In progress, can be edited |
| `SUBMITTED` | Hospital | Submitted, awaiting SHA intake |
| `RECEIVED` | SHA | Accepted into processing queue |
| `VALIDATING` | SHA | Running compliance rules |
| `ANALYZING` | SHA | Running AI analysis |
| `ASSESSED` | SHA | Evaluating risk score |
| `CLEARED` | SHA | Approved for payment |
| `FLAGGED` | SHA | Failed compliance/AI/risk checks |
| `UNDER_REVIEW` | SHA | Human investigation in progress |
| `RESOLVED` | SHA | Investigation complete |

### 4.3 SHA Intake (RECEIVED)

When SHA officer marks claim as "received", status moves to `RECEIVED`. The claim enters the processing queue visible at `/sha/claims`.

---

## 5. Compliance Rules Engine

### 5.1 Triggering Rules

When a claim moves to `VALIDATING`, the system runs `evaluateClaimRules(claimId)`:

```prisma
ComplianceRule {
  code: String           // "R-001", "R-002", etc.
  name: String          // "Facility Not Verified"
  category: String       // "FACILITY", "CLAIM", "AMOUNT"
  severity: FindingSeverity  // LOW | MEDIUM | HIGH | CRITICAL
  scoreContribution: Int   // Points added to risk score if triggered
  active: Boolean
}
```

### 5.2 Rules Evaluated

| Code | Name | Trigger Condition | Score |
|------|------|-------------------|-------|
| R-001 | Facility Not Verified | `hospital.verificationStatus ≠ VERIFIED` | +25 |
| R-002 | Facility Service Mismatch | Claim item service not in hospital's authorized services | +20 |
| R-003 | Duplicate Claim | (Requires history analysis — not yet implemented) | +30 |
| R-004 | Unusual Claim Amount | `totalAmount > 750,000 KES` (>3× average) | +15 |
| R-005 | Unusual Quantity | Any line item quantity > 10 | +10 |
| R-006 | Diagnosis Mismatch | (Requires clinical data — not yet implemented) | +20 |

### 5.3 Evaluation Results

For each rule, a `ClaimRuleEvaluation` is created or updated:

```prisma
ClaimRuleEvaluation {
  claimId: String
  complianceRuleId: String
  triggered: Boolean
  scoreContribution: Int  // 0 if not triggered
  explanation: String?   // Human-readable result
}
```

**Example:** For a claim from Rift Valley Clinic (UNVERIFIED) with MRI service:
- R-001: TRIGGERED (+25)
- R-002: TRIGGERED (+20) — MRI not in hospital's services
- Total: +45 from rules alone

---

## 6. AI Analysis

### 6.1 When AI Runs

After `VALIDATING`, claim moves to `ANALYZING`. The system calls `analyzeClaim(claimId)`.

### 6.2 Building the Context

The system constructs a `ClaimContext` with:

```
- Claim reference and total amount
- Hospital name, status, verification status
- Hospital's authorized services
- All line items (service, quantity, unit price)
- Compliance rule evaluation results
- Previous claim count for this hospital
```

### 6.3 AI Providers

The system supports three providers (configured via `AI_PROVIDER` env var):

| Provider | Env Vars | Description |
|----------|----------|-------------|
| Groq | `GROQ_API_KEY`, `GROQ_MODEL` | Fast, affordable |
| OpenRouter | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Access to multiple models |
| Mock | (none) | Returns simulated findings |

**Mock provider logic:**
- Detects unverified/suspended hospitals → HIGH severity finding
- Detects services not in hospital's authorization → SERVICE_MISMATCH
- Detects high amounts (>KES 5,000) → AMOUNT_ANOMALY
- Detects unusual quantities (>10) → QUANTITY_ANOMALY
- Factors in triggered compliance rules → PATTERN_ANOMALY

### 6.4 AI Output

The AI returns an `AiAnalysisResponse`:

```typescript
{
  assessment: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK"
  confidence: number  // 0.0 - 1.0
  summary: string     // Human-readable summary
  findings: AiFinding[]  // Specific issues found
  riskScore: number // 0-100
}
```

### 6.5 Persisting AI Results

For each AI finding, two records are created:

```prisma
// Detailed AI finding
AiFinding {
  analysisId: String
  claimId: String
  type: String        // e.g., "SERVICE_MISMATCH"
  severity: FindingSeverity
  confidence: Float
  explanation: String?
  reasoning: String?
}

// General finding record (unified findings table)
Finding {
  claimId: String
  source: "AI" | "RULE" | "SYSTEM" | "REVIEW"
  type: String
  severity: FindingSeverity
  explanation: String?
  evidence: Json?     // { aiAnalysisId, reasoning }
  scoreContribution: Int
}
```

---

## 7. Risk Score Calculation

### 7.1 When Risk is Calculated

After `ANALYZING`, claim moves to `ASSESSED`. The system calls `calculateRiskScore(claimId)`.

### 7.2 Scoring Algorithm

Risk score is the sum of all contributing factors:

```
Total Score = Σ (Rule contributions) + Σ (AI finding contributions) + System adjustments
```

| Factor | Calculation |
|--------|-------------|
| Rule trigger | `rule.scoreContribution` if triggered |
| AI finding | `baseScore × confidence` where baseScore is 25/15/10/5 for CRITICAL/HIGH/MEDIUM/LOW |
| High amount | +20 if total > KES 500,000 |
| Cap | Maximum 100 |

### 7.3 Risk Levels

| Score | Level | Action |
|-------|-------|--------|
| 0-24 | `LOW` | CLEARED |
| 25-49 | `MODERATE` | CLEARED |
| 50-74 | `HIGH` | FLAGGED |
| 75-100 | `CRITICAL` | FLAGGED |

### 7.4 Risk Contributors

Each factor is recorded as a `RiskContributor`:

```prisma
RiskScore {
  claimId: String
  score: Int        // 0-100
  level: RiskLevel  // LOW | MODERATE | HIGH | CRITICAL
}

RiskContributor {
  riskScoreId: String
  type: String      // "RULE" | "AI" | "SYSTEM"
  description: String  // Human-readable explanation
  scoreImpact: Int   // Points contributed
}
```

---

## 8. Alert Generation

### 8.1 When Alerts are Created

After `ASSESSED`, if status becomes `FLAGGED`, the system calls `generateAlerts(claimId)`.

### 8.2 Alert Types

```prisma
Alert {
  type: AlertType  // HIGH_RISK_CLAIM | FACILITY_VERIFICATION | SERVICE_MISMATCH | AI_REVIEW_REQUIRED
  severity: FindingSeverity
  status: AlertStatus  // OPEN | ACKNOWLEDGED | UNDER_REVIEW | RESOLVED | DISMISSED
  title: String
  description: String?
  claimId: String?
  hospitalId: String?
  riskScoreId: String?
  source: FindingSource  // RULE | AI | SYSTEM | REVIEW
  metadata: Json?        // Additional context
}
```

### 8.3 Alert Triggers

| Condition | Alert Type | Severity |
|----------|-----------|----------|
| Risk level = CRITICAL | `HIGH_RISK_CLAIM` | CRITICAL |
| Risk level = HIGH | `HIGH_RISK_CLAIM` | HIGH |
| Hospital not verified | `FACILITY_VERIFICATION` | HIGH |
| R-002 triggered (service mismatch) | `SERVICE_MISMATCH` | HIGH |
| AI finding with HIGH/CRITICAL severity | `AI_REVIEW_REQUIRED` | From finding |

### 8.4 Deduplication

Before creating an alert, the system checks:

```sql
SELECT * FROM Alert WHERE
  type = input.type AND
  claimId = input.claimId AND
  status IN ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW')
```

If a matching alert exists, no new alert is created.

---

## 9. Investigator Review

### 9.1 Alert Actions

SHA officers can take these actions on alerts:

| Action | Effect |
|--------|--------|
| **Acknowledge** | `OPEN → ACKNOWLEDGED` |
| **Start Review** | `ACKNOWLEDGED → UNDER_REVIEW`; also sets claim to `UNDER_REVIEW` |
| **Resolve** | `UNDER_REVIEW → RESOLVED`; sets `resolvedAt`, `resolvedById`; claim to `RESOLVED` |
| **Dismiss** | `UNDER_REVIEW → DISMISSED`; sets `resolvedAt`, `resolvedById` |

### 9.2 Review Workflow

```
Alert OPEN
    ↓ Acknowledge
Alert ACKNOWLEDGED
    ↓ Start Review
Alert UNDER_REVIEW + Claim UNDER_REVIEW
    ↓ Resolve/Dismiss
Alert RESOLVED/DISMISSED + Claim RESOLVED
```

---

## 10. End-to-End Example

### Scenario: Coast Medical Centre submits a fracture claim

**Step 1: Hospital Setup**
- Coast Medical Centre (HOSP-002) is `ACTIVE` and `VERIFIED`
- Authorized for: CONSULTATION, MALARIA_TEST, CBC, X_RAY, EMERGENCY
- NOT authorized for: MRI, SURGERY, ORTHOPEDICS

**Step 2: Invoice Creation**
- User creates draft claim CLM-2026-004
- Adds items:
  - X-RAY (authorized): 1 × KES 3,000
  - EMERGENCY (authorized): 1 × KES 5,500
  - Total: KES 8,500

**Step 3: Submission**
- User submits claim → status: `RECEIVED`
- SHA officer advances → `VALIDATING`

**Step 4: Rule Evaluation**
- R-001: NOT triggered (hospital verified)
- R-002: TRIGGERED (+20) — emergency service not in authorized list
- R-004: TRIGGERED (+15) — amount KES 8,500 > threshold
- Rules total: +35

**Step 5: AI Analysis**
- AI sees: unverified service, high amount, triggered rules
- Returns: `HIGH_RISK`, confidence 0.85
- Findings: SERVICE_RELEVANCE (HIGH, 0.85)

**Step 6: Risk Score**
- Rules: +35
- AI finding: +15 × 0.85 = +13
- Total: 48 → `MODERATE` → but triggered rules push to FLAGGED

**Step 7: Alert**
- Alert created: "High risk claim: CLM-2026-004"
- Status: `OPEN`

**Step 8: Investigation**
- Officer acknowledges → `ACKNOWLEDGED`
- Officer starts review → `UNDER_REVIEW`, claim `UNDER_REVIEW`
- Officer investigates, finds billing error
- Officer resolves → `RESOLVED`, claim `RESOLVED`

---

## 11. Data Flow Diagram

```
Hospital Portal                              SHA Portal
     │                                            │
     ▼                                            │
[Create Hospital] ─────────────────────────────► │
     │                                            │
[Add Services] ─────────────────────────────────► │
     │                                            │
[Create User] ──────────────────────────────────► │
     │                                            │
[Create Invoice (DRAFT)]                         │
     │                                            │
[Add Line Items]                                │
     │                                            │
[Submit Claim] ────────► RECEIVED ─────────────► │
                         │                        │
                         ▼                        │
                   VALIDATING                     │
                         │                        │
              ┌──────────┴──────────┐              │
              │  Run Compliance    │              │
              │  Rules (R-001 etc) │              │
              └──────────┬──────────┘              │
                         │                        │
                   ANALYZING                      │
                         │                        │
              ┌──────────┴──────────┐              │
              │  AI Analysis        │              │
              │  (Groq/OpenRouter)   │              │
              └──────────┬──────────┘              │
                         │                        │
                   ASSESSED                        │
                         │                        │
              ┌──────────┴──────────┐              │
              │  Calculate Risk     │              │
              │  Score (0-100)      │              │
              └──────────┬──────────┘              │
                         │                        │
              ┌──────────┴──────────┐              │
              │  Score ≥ 50?        │              │
              │  FLAGGED : CLEARED  │              │
              └──────────┬──────────┘              │
                         │                        │
                    FLAGGED                        │
                         │                        │
              ┌──────────┴──────────┐              │
              │  Generate Alerts   │              │
              │  (deduplicated)     │              │
              └──────────┬──────────┘              │
                         │                        │
                   UNDER_REVIEW ◄─────────────────│
                         │                        │
              ┌──────────┴──────────┐              │
              │  Investigator        │              │
              │  Reviews & Acts     │              │
              └──────────┬──────────┘              │
                         │                        │
                      RESOLVED                     │
```

---

## 12. Key Files Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | All data models and enums |
| `prisma/seed.ts` | Demo data (hospitals, claims, rules) |
| `lib/rules/engine.ts` | Compliance rule evaluation |
| `lib/ai/provider.ts` | AI provider abstraction |
| `lib/ai/claim-analyzer.ts` | AI analysis orchestration |
| `lib/risk/calculator.ts` | Risk score calculation |
| `lib/alerts/generator.ts` | Alert creation & deduplication |
| `app/sha/claims/[id]/_actions/process-claim.ts` | Main processing pipeline |
| `app/sha/alerts/_actions/alert-actions.ts` | Alert management actions |
| `app/hospital/invoices/_actions/invoice-actions.ts` | Invoice/claim creation |

---

## 13. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | JWT signing secret |
| `AI_PROVIDER` | No | `groq`, `openrouter`, or `mock` (default: `mock`) |
| `GROQ_API_KEY` | For Groq | Groq API key |
| `GROQ_MODEL` | No | Groq model (default: `llama-3.1-70b-versatile`) |
| `OPENROUTER_API_KEY` | For OpenRouter | OpenRouter API key |
| `OPENROUTER_MODEL` | No | OpenRouter model (default: `anthropic/claude-3-haiku`) |

---

## 14. Future Enhancements

- **R-003 Duplicate Claim Detection** — Compare current claim against historical claims for same patient/hospital
- **R-006 Diagnosis Matching** — Clinical rules linking diagnosis to services
- **Real-time Notifications** — Webhook/email when claims are flagged
- **Claim Amending** — Allow hospitals to correct flagged claims before rejection
- **Appeal Process** — Hospital can dispute a FLAGGED decision
