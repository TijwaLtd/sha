# How Anomaly Detection Works

The pipeline runs in 4 phases when an SHA officer clicks **Process Claim**:

```
RECEIVED → VALIDATING (rules) → ANALYZING (AI) → ASSESSED (risk) → FLAGGED/CLEARED
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

All rule scores + AI scores are summed. If **≥ 50** → **FLAGGED** → alert generated.

---

## How to Test Each Anomaly

### Test the cross-facility duplicate (Patient A)

This is already seeded. Here's exactly what to do:

1. **Login** as `sarah@sha.go.ke` (SHA Officer)
2. Go to **Claims** — you'll see two claims from `PAT-SYN-201`:
   - `CLM-2026-40001-CF1` from Nakuru County Referral (CT scan, Aug 11)
   - `CLM-2026-50001-CF2` from Eldoret National Referral (CT scan, Aug 12)
3. **Process the first claim** (Nakuru) — it will CLEARED (no prior claims to match)
4. **Process the second claim** (Eldoret) — it will FLAGGED because R-007 fires (same patient, same service, different hospital, within 5 days)
5. Check the **Alerts** page — you'll see a `CROSS_FACILITY_ANOMALY` alert

### Test the dispensary scope breach (Patient B)

Also already seeded:

1. Go to **Claims** — find `PAT-SYN-202` claims:
   - `CLM-2026-10001-RF1` from Kibera Dispensary (X-ray, Aug 13) — already FLAGGED
   - `CLM-2026-30001-RF2` from Kiambu Sub-County (X-ray + surgery, Aug 15) — UNDER_REVIEW
2. The dispensary claim fires **R-001** (unverified) + **R-002** (X-ray not authorized)
3. The Kiambu claim is a legitimate referral — it's CLEARED but linked to Patient B's history

### Test a new claim yourself

To test any scenario from scratch:

1. **Login** as a hospital user (e.g., `faith@kiberadispensary.co.ke`)
2. Go to **Invoices** → **Create New Invoice**
3. Add items matching the test case (e.g., X_RAY at a dispensary)
4. **Submit** the claim
5. **Logout**, login as `sarah@sha.go.ke`
6. Go to **Claims** → find the new claim → click **Process**
7. Check the result: **Rules** tab shows which rules fired, **Risk Score** shows total

### Quick test matrix

| Test | Login as | Create claim with | Expected |
|------|----------|------------------|----------|
| Unverified facility | faith@kiberadispensary.co.ke | Any service | R-001 → FLAGGED |
| Service mismatch | faith@kiberadispensary.co.ke | X_RAY | R-001+R-002 → FLAGGED |
| High amount | james@nairobinrh.go.ke | SURGERY_MAJOR × 2 + ICU × 20 | R-004 → depends on total |
| Unusual quantity | mercy@kakamegahc.co.ke | PHARMACY × 14 | R-005 → score 10 (CLEARED) |
| Cross-facility duplicate | Create 2 claims for same patient at 2 hospitals within 5 days | Same service at both | R-007 → FLAGGED |
| Tariff exceeded | esther@nakurureferral.go.ke | CONSULTATION × 1 @ KES 5,000 (max is KES 2,000) | R-010 → score 15 |
| Patient frequency | Create 5+ claims for same patient, same service | Same service each time | R-012 → score 20 |

The key insight: **detection only happens when an SHA officer processes the claim**. Hospital users can bill anything — the system catches anomalies at processing time, not at creation time.
