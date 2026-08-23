# How Anomaly Detection Works

The pipeline runs in 4 phases when an SHA officer clicks **Process Claim**:

```
SUBMITTED/RECEIVED -> VALIDATING (rules) -> ANALYZING (AI) -> ASSESSED (risk) -> FLAGGED/CLEARED
```

## Phase 1: Base Rules (instant, deterministic)

| Rule | What it checks | Score |
|------|---------------|-------|
| R-001 | Is the hospital VERIFIED? | +50 |
| R-002 | Is the service in the hospital's authorized list? | +50 |
| R-003 | Has the same patient been billed for this service at this hospital within 5 days? | +30 |
| R-004 | Is total claim > KES 750,000? | +15 |
| R-005 | Is any line item quantity > 10? | +10 |
| R-007 | Has the same patient been billed for this service at a *different* hospital within 5 days? | +35 |

## Phase 2: Contextual Rules (queries DB for equipment, tariffs, capacity, billing)

| Rule | What it checks | Score |
|------|---------------|-------|
| R-008 | Does the hospital have the required equipment operational? | +20 |
| R-009 | Does claimed quantity exceed operational equipment count? | +15 |
| R-010 | Does the unit amount exceed the tariff max? | +15 |
| R-011 | Is the hospital accredited for this service? | +25 |
| R-012 | Has this patient received this service 5+ times in 90 days? | +20 |
| R-013 | Has this patient's cumulative spending exceeded KES 50,000? | +15 |
| R-014 | Does the hospital's daily billing total exceed the policy limit? | +20 |
| R-015 | Does the hospital's monthly billing total exceed the policy limit? | +15 |
| R-016 | Is the service allowed for this facility level? | +10 |

## Phase 3: AI Analysis (calls Groq/OpenRouter/OpenAI)

AI reviews the claim context and generates findings with severity and confidence.

## Phase 4: Risk Score

All rule scores + AI scores are summed. If >= 50 -> FLAGGED -> alert generated.

---

## What's Already Seeded

The seed creates **35 claims** across 15 hospitals:

| Status | Count | Where |
|--------|-------|-------|
| CLEARED | 15 | One normal case per hospital |
| FLAGGED | 15 | One anomaly case per hospital |
| SUBMITTED | 2 | Patient A's cross-facility claims (awaiting processing) |
| UNDER_REVIEW | 2 | Patient B's claims (being investigated) |
| DRAFT | 1 | Nairobi National Referral (incomplete) |

### Patient A - Cross-Facility Duplicate (PAT-SYN-201)

Same patient billed for CT scan at two different hospitals, one day apart:

| Claim | Hospital | Status | What happened |
|-------|----------|--------|---------------|
| CLM-2026-40001-CF1 | Nakuru County Referral | SUBMITTED | CT scan KES 8,000 (Aug 11) |
| CLM-2026-50001-CF2 | Eldoret National Referral | SUBMITTED | CT scan KES 10,000 (Aug 12) |

**To test:** Process Nakuru claim first (CLEARED), then Eldoret claim (R-007 fires -> FLAGGED).

### Patient B - Dispensary Scope Breach + Referral (PAT-SYN-202)

Dispensary bills X-ray (outside scope), then legitimate referral at sub-county:

| Claim | Hospital | Status | What happened |
|-------|----------|--------|---------------|
| CLM-2026-10001-RF1 | Kibera Community Dispensary | UNDER_REVIEW | X-ray KES 1,500 (Aug 13) - scope breach |
| CLM-2026-30001-RF2 | Kiambu Sub-County Hospital | UNDER_REVIEW | X-ray + surgery KES 9,500 (Aug 15) - legitimate referral |

### Seeded Anomaly Cases (one per hospital level)

| Hospital | Level | Claim | Anomaly |
|----------|-------|-------|---------|
| Kibera Dispensary | Dispensary | CLM-2026-10001-02 FLAGGED | X-ray at dispensary (R-001+R-002) |
| Kitale Dispensary | Dispensary | CLM-2026-10002-02 FLAGGED | Specialist consult at dispensary |
| Bungoma Dispensary | Dispensary | CLM-2026-10003-02 FLAGGED | Specialist consult at dispensary |
| Machakos HC | Health Centre | CLM-2026-20001-02 FLAGGED | CT scan at health centre |
| Kakamega HC | Health Centre | CLM-2026-20002-02 FLAGGED | Pharmacy qty 14 (R-005) |
| Lamu HC | Health Centre | CLM-2026-20003-02 FLAGGED | Unverified facility |
| Kiambu Sub-County | Sub-County | CLM-2026-30001-02 FLAGGED | CT scan at sub-county |
| Machakos Sub-County | Sub-County | CLM-2026-30002-02 FLAGGED | CT scan at sub-county |
| Siaya Sub-County | Sub-County | CLM-2026-30003-02 FLAGGED | Suspended facility |
| Nakuru County Referral | County Referral | CLM-2026-40001-02 FLAGGED | Ortho surgery + ICU KES 830K (R-004) |
| Kakamega County Referral | County Referral | CLM-2026-40002-02 FLAGGED | High amount surgery |
| Garissa County Referral | County Referral | CLM-2026-40003-02 FLAGGED | Pending verification |
| Eldoret National Referral | National Referral | CLM-2026-50001-02 FLAGGED | Multi-trauma KES 1.2M (R-004+R-005) |
| Nairobi National Referral | National Referral | CLM-2026-50002-02 FLAGGED | High amount chemo |
| Coast National Referral | National Referral | CLM-2026-50003-02 FLAGGED | Inactive facility |

---

## How to Test

### Test the cross-facility duplicate (Patient A)

1. **Login** as sarah@sha.go.ke (SHA Officer)
2. Go to **Claims** - filter shows 2 SUBMITTED claims from PAT-SYN-201
3. **Process CLM-2026-40001-CF1** (Nakuru) -> CLEARED (no prior claims)
4. **Process CLM-2026-50001-CF2** (Eldoret) -> FLAGGED (R-007: same patient, same CT scan, different hospital, 1 day apart)
5. Check **Alerts** -> CROSS_FACILITY_ANOMALY alert

### Test the dispensary scope breach (Patient B)

1. Go to **Claims** - find CLM-2026-10001-RF1 (Kibera) -> already UNDER_REVIEW
2. The Kibera claim fired R-001 (unverified) + R-002 (X-ray not authorized)
3. The Kiambu claim CLM-2026-30001-RF2 is a legitimate referral - also UNDER_REVIEW

### Test a seeded anomaly

1. Login as sarah@sha.go.ke
2. Go to **Claims** - find any FLAGGED claim (e.g., CLM-2026-10001-02)
3. Click to view details - see which rules fired and risk score
4. These are already processed - no need to click Process

### Test a new claim yourself

1. **Login** as hospital user (e.g., faith@kiberadispensary.co.ke)
2. Go to **Invoices** -> **Create New Invoice**
3. Add items (e.g., X_RAY at a dispensary)
4. **Submit** the claim
5. **Logout**, login as sarah@sha.go.ke
6. Go to **Claims** -> find the new SUBMITTED claim -> click **Process**
7. Check result: Rules tab shows which rules fired, Risk Score shows total

### Quick test matrix

| Test | Login as | Create claim with | Expected |
|------|----------|------------------|----------|
| Unverified facility | faith@kiberadispensary.co.ke | Any service | R-001 -> FLAGGED |
| Service mismatch | faith@kiberadispensary.co.ke | X_RAY | R-001+R-002 -> FLAGGED |
| High amount | james@nairobinrh.go.ke | SURGERY_MAJOR x 2 + ICU x 20 | R-004 -> depends on total |
| Unusual quantity | mercy@kakamegahc.co.ke | PHARMACY x 14 | R-005 -> score 10 (CLEARED) |
| Cross-facility duplicate | Create 2 claims for same patient at 2 hospitals within 5 days | Same service at both | R-007 -> FLAGGED |
| Tariff exceeded | esther@nakurureferral.go.ke | CONSULTATION x 1 @ KES 5,000 (max is KES 2,000) | R-010 -> score 15 |
| Patient frequency | Create 5+ claims for same patient, same service | Same service each time | R-012 -> score 20 |

---

## Billing Policy Limits

| Level | Per Encounter | Per Service | Daily Limit |
|-------|--------------|-------------|-------------|
| Dispensary | KES 10,000 | KES 5,000 | KES 15,000 |
| Health Centre | KES 50,000 | KES 30,000 | KES 75,000 |
| Sub-County | KES 200,000 | KES 100,000 | KES 300,000 |
| County Referral | KES 500,000 | KES 200,000 | KES 600,000 |
| National Referral | KES 2,000,000 | KES 1,000,000 | KES 2,500,000 |

The key insight: **detection only happens when an SHA officer processes the claim**. Hospital users can bill anything - the system catches anomalies at processing time, not at creation time.
