# PHASE 1 — DATABASE FOUNDATION

## OBJECTIVE

Build and verify the complete database foundation for the SHA Compliance demonstration platform.

This phase is DATABASE ONLY.

Do not build application pages.

Do not build the dashboard.

Do not build claim UI.

Do not build hospital UI.

Do not integrate Groq.

Do not integrate OpenRouter.

Do not implement Server Actions.

Do not implement the application shell.

The goal is to establish a reliable domain model that every future phase can build on.

---

# 1. FIRST STEP — INSPECT THE EXISTING PROJECT

Before modifying anything inspect:

- package.json
- prisma/schema.prisma
- prisma migrations
- Prisma configuration
- existing seed files
- existing database utilities
- existing environment configuration
- existing authentication models if present

Do not overwrite existing work blindly.

Determine what already exists.

Reuse compatible existing models.

---

# 2. DATABASE DOMAIN

The database should support the following conceptual areas:

## Identity

- User
- Role where appropriate

## Facilities

- Hospital
- Hospital service/capability
- Hospital status
- Hospital verification

## Claims

- Claim
- Claim item
- Service/medical code
- Claim status

## Compliance

- Compliance rule
- Claim rule evaluation
- Finding

## AI

- AI analysis
- AI finding
- AI provider/model metadata

## Risk

- Risk score
- Risk contributor

## Investigation

- Review
- Review action/resolution

## Audit

- Audit log

---

# 3. USER

Users represent people operating the compliance platform.

A user should support appropriate:

- id
- name
- email
- authentication relationship
- role
- createdAt
- updatedAt

Do not create unnecessary user profile fields.

---

# 4. HOSPITAL

A hospital/facility represents the healthcare provider submitting claims.

Conceptually support:

- id
- facility identifier
- name
- type
- registration status
- operational status
- verification status
- location metadata where appropriate
- createdAt
- updatedAt

Possible status concepts:

ACTIVE
INACTIVE
SUSPENDED
UNKNOWN

Verification:

VERIFIED
UNVERIFIED
PENDING
REJECTED

Keep verification and operational status conceptually separate.

---

# 5. HOSPITAL SERVICES

A facility must have explicit service capabilities.

Examples:

- outpatient
- maternity
- laboratory
- radiology
- surgery
- orthopedics

The relationship should allow the system to answer:

"Does this facility provide the service being claimed?"

Do not simply store services as an unstructured string.

Use normalized relationships where appropriate.

---

# 6. MEDICAL SERVICES / CLAIMABLE SERVICES

Create a normalized service/code representation where appropriate.

A service should support:

- code
- name
- description
- category
- active status

Examples:

CONSULTATION

MALARIA_TEST

CBC

MRI

X_RAY

SURGERY

MATERNITY

Do not hard-code service names throughout application logic.

---

# 7. CLAIM

A claim represents a billing request submitted by a facility.

Support:

- id
- claim reference
- hospital relationship
- patient reference
- diagnosis/context fields appropriate for the demonstration
- claim status
- submission timestamp
- total amount in cents
- processing metadata
- createdAt
- updatedAt

Patient data must be synthetic.

Do not build real patient PII into the demonstration.

---

# 8. CLAIM ITEM

Each claim contains one or more claim items.

Support:

- id
- claim relationship
- service relationship
- description
- quantity
- unit amount in cents
- total amount in cents
- metadata where necessary

Do not store monetary amounts as Float.

All monetary fields must be integer cents.

---

# 9. CLAIM TOTAL

Where practical, avoid storing redundant totals that can become inconsistent.

If a claim total is persisted for performance or snapshot purposes, clearly establish how it is maintained.

The source of truth for line items must remain clear.

---

# 10. COMPLIANCE RULE

A compliance rule represents a deterministic screening rule.

Support:

- code
- name
- description
- category
- severity
- score contribution
- active status
- createdAt
- updatedAt

Examples:

R-001

Facility not verified

R-002

Facility service mismatch

R-003

Duplicate claim

R-004

Unusual claim amount

R-005

Unusual quantity

Do not hard-code the complete rule catalogue into TypeScript.

---

# 11. RULE EVALUATION

A claim may trigger multiple rules.

Represent the relationship between:

Claim

and

ComplianceRule

through an evaluation/result model where necessary.

An evaluation should capture:

- rule
- claim
- status/result
- score contribution
- explanation
- evaluation timestamp

This allows the system to explain:

Why was this claim flagged?

---

# 12. FINDINGS

A finding represents an identified compliance concern.

A finding may relate to:

- claim
- claim item
- rule
- AI analysis

Support:

- finding type
- severity
- title
- explanation
- evidence/reference metadata
- score contribution
- source

Possible sources:

RULE
AI
SYSTEM
REVIEW

Do not make AI findings indistinguishable from deterministic rule findings.

---

# 13. AI ANALYSIS

Represent AI analysis separately from claims.

Support:

- claim relationship
- provider
- model
- status
- prompt/version metadata where appropriate
- structured response
- confidence
- startedAt
- completedAt
- error metadata where appropriate

AI output must not be treated as the final claim decision.

Store structured results.

Do not depend entirely on raw text.

---

# 14. AI FINDINGS

If the AI identifies findings, store them in a structured form.

A finding should be traceable to:

- claim
- claim item if relevant
- AI analysis
- finding type
- severity
- confidence
- explanation

This enables the UI to later show:

"AI-assisted finding"

rather than pretending the AI itself made a final fraud determination.

---

# 15. RISK SCORE

A claim must be capable of receiving a risk assessment.

Support:

- claim
- score
- risk level
- calculated timestamp

Risk levels should be explicit.

For example:

LOW
MODERATE
HIGH
CRITICAL

The system should also preserve the contributors to the score.

---

# 16. RISK CONTRIBUTORS

Risk contributors should allow the system to explain a score.

Example:

Risk Score:

82

Contributors:

+25 Service mismatch

+20 AI relevance concern

+15 unusual billing

+22 facility capability concern

Do not only store the final score.

Store the reasons contributing to it.

---

# 17. CLAIM REVIEW

A flagged claim may be reviewed by a human.

Support:

- claim
- reviewer
- status
- notes
- decision
- startedAt
- completedAt
- createdAt
- updatedAt

Possible review statuses:

PENDING
IN_PROGRESS
COMPLETED

Possible outcomes should avoid asserting legal guilt.

Examples:

CLEARED
CONFIRMED_ANOMALY
REJECTED_CLAIM
ESCALATED
NEEDS_MORE_INFORMATION

Use terminology appropriate to the demonstration.

---

# 18. AUDIT LOG

Important actions must be auditable.

Support:

- actor/user
- action
- entity type
- entity id
- metadata
- timestamp

Examples:

CLAIM_FLAGGED

CLAIM_CLEARED

REVIEW_STARTED

REVIEW_COMPLETED

HOSPITAL_STATUS_CHANGED

Do not store secrets in audit metadata.

---

# 19. CLAIM STATUS

Create a coherent claim lifecycle.

Suggested:

RECEIVED

VALIDATING

ANALYZING

ASSESSED

FLAGGED

CLEARED

UNDER_REVIEW

RESOLVED

Do not add excessive states without a real workflow need.

---

# 20. RELATIONSHIP REQUIREMENTS

The schema must allow:

Hospital
→ Claims

Hospital
→ Services

Claim
→ Claim Items

Claim Item
→ Service

Claim
→ Rule Evaluations

Claim
→ Findings

Claim
→ AI Analyses

AI Analysis
→ AI Findings

Claim
→ Risk Assessment

Claim
→ Reviews

User
→ Reviews

User
→ Audit Logs

---

# 21. INDEXING

Add indexes for anticipated operational queries.

At minimum consider:

Hospital claim lookups

Claim status

Claim submission date

Flagged claims

Risk level

Review status

Hospital status

Claim reference

Do not add indexes blindly.

Only add useful indexes based on query patterns.

---

# 22. UNIQUE CONSTRAINTS

Use appropriate uniqueness for:

- claim reference
- hospital/facility identifier
- service code
- compliance rule code

Ensure uniqueness reflects actual domain requirements.

---

# 23. MONEY

Every financial database field must use integer cents.

Examples:

unitAmountCents

totalAmountCents

risk-related financial thresholds should also follow appropriate integer representation if monetary.

Never:

amount Float

Never:

amount Decimal

unless there is a deliberate architectural reason approved before implementation.

---

# 24. ENUMS

Use Prisma enums where the state is controlled and stable.

Examples:

ClaimStatus

HospitalStatus

VerificationStatus

RiskLevel

ReviewStatus

FindingSeverity

FindingSource

Do not create enums for values that will clearly become user-configurable database records.

---

# 25. DEMO SEED DATA

Create realistic fictional demo data.

The seed should demonstrate:

### Verified low-risk hospital

Normal claims.

### Verified hospital with suspicious claims

Unusual services/amounts.

### Unverified hospital

Claims that trigger facility concerns.

### Hospital with limited services

Claims containing services outside its capabilities.

### Multiple claims

Enough data to demonstrate:

- claim queue
- flagged claims
- hospital risk
- rule findings
- AI findings
- review workflow

All patient references must be synthetic.

---

# 26. SEED DATA QUALITY

The seed should make the eventual UI immediately demonstrable.

Do not create 10,000 fake records.

A focused dataset is better.

For example:

5–10 hospitals

20–50 claims

Multiple claim items per claim

Several triggered findings

Several clean claims

Several review records

Enough variety to demonstrate the system.

---

# 27. MIGRATION

Create a proper Prisma migration.

Do not use destructive database resets against a database containing important existing project data.

Follow the existing project's migration workflow.

---

# 28. PRISMA CLIENT

Use the existing Prisma client pattern.

Do not create multiple competing Prisma client implementations.

---

# 29. VALIDATION OF PHASE 1

After implementation:

Run Prisma validation.

Run Prisma formatting.

Run migrations as appropriate.

Run seed.

Run TypeScript.

Run lint.

Run build.

Fix all errors introduced by this phase.

---

# 30. DO NOT BUILD UI

This phase must not implement:

- pages
- dashboards
- forms
- shadcn components
- navigation
- claim lists
- hospital lists
- AI screens

The only exception is existing infrastructure that must be minimally adjusted to support the database.

---

# 31. FINAL REVIEW

Before declaring Phase 1 complete, verify:

Can the database represent a hospital?

Can it represent the services a hospital provides?

Can it represent a claim?

Can it represent claim items?

Can it represent compliance rules?

Can it represent rule evaluations?

Can it represent AI analysis?

Can it represent AI findings?

Can it represent risk?

Can it explain risk contributors?

Can it represent human review?

Can it audit important actions?

Can it support real-time claim ingestion later?

Can every monetary value be stored as integer cents?

If any answer is no, fix the schema before proceeding.

---

# 32. COMPLETION REPORT

When complete, report:

## Existing Schema Inspected

What already existed.

## Models Added

List every model.

## Models Modified

List every modified model.

## Relationships

Explain important relationships.

## Enums

List enums.

## Indexes

List important indexes.

## Constraints

List important unique/foreign-key constraints.

## Money

Explain how cents are handled.

## Seed Data

Describe demo data.

## Migration

Migration created.

## Validation

Prisma validation result.

## TypeScript

Result.

## Lint

Result.

## Build

Result.

## Risks / Decisions

Any schema decisions that may need review.

Then STOP.

Do not start Phase 2.

# HOSPITAL USER RELATIONSHIP

The schema must support a hospital user being associated with a specific hospital/facility.

A hospital user must be able to:

- create claims for their hospital
- view claims belonging to their hospital
- never access another hospital's claims

The relationship must support server-side authorization.

Do not rely on a hospitalId submitted by the client.

---

# USER ROLES

The schema must support role-based application access.

At minimum:

HOSPITAL_USER
SHA_OFFICER
ADMIN

Use the existing authentication architecture where available.

Do not duplicate an existing role system.

---

# HOSPITAL CLAIM OWNERSHIP

A Claim belongs to a Hospital.

Hospital users are associated with a Hospital.

The database relationships must make it possible to determine:

User → Hospital → Claims

without relying on client-side state.

---

# INVOICE DRAFTS

The hospital workflow requires draft invoices before submission.

The Claim model should support a draft state.

A hospital user must be able to:

Create draft
→ Add items
→ Edit draft
→ Review draft
→ Submit

Only submitted claims enter the SHA processing workflow.

---

# CLAIM SUBMISSION

The schema must support:

- submission timestamp
- claim status
- claim reference
- processing status

A draft should not appear as an incoming SHA claim.

---

# CLAIM SOURCE

Where useful, distinguish how a claim entered the system.

For example:

HOSPITAL_PORTAL
API
IMPORT

For the initial demonstration, HOSPITAL_PORTAL is the primary source.

Design this so that future real-time/API submissions can use the same Claim model.
