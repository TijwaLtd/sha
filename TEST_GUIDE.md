# SHA Compliance - Test Claim Guide

This guide explains how detection works and provides step-by-step test scenarios using the seed data.

---

## How Detection Works

### The Flow: Hospital Creates Invoice → SHA Processes → Detection Happens

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HOSPITAL PORTAL                                      │
│  1. Login as hospital user                                                  │
│  2. Create new invoice (draft claim)                                        │
│  3. Add line items (SELECT FROM AVAILABLE SERVICES)                        │
│  4. Submit claim → status: RECEIVED                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SHA PROCESSING                                     │
│  5. SHA officer clicks "Process"                                           │
│  6. VALIDATING: Compliance rules run                                        │
│     - R-001: Hospital verified?                                            │
│     - R-002: All services authorized?                                      │
│     - R-003: Duplicate claim? (not implemented)                            │
│     - R-004: Unusual amount? (>KES 750,000)                               │
│     - R-005: Unusual quantity? (>10 units)                                 │
│     - R-006: Diagnosis mismatch? (not implemented)                          │
│  7. ANALYZING: AI runs analysis                                            │
│     - Builds context (hospital, services, amounts, rules)                   │
│     - Sends to Groq/OpenRouter/Mock                                        │
│     - Returns findings with severity                                        │
│  8. ASSESSED: Risk score calculated                                        │
│     - Score = rules + AI findings + system factors                          │
│     - If score ≥ 50 → FLAGGED                                              │
│  9. FLAGGED: Alerts generated (deduplicated)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INVESTIGATOR REVIEW                                   │
│  10. SHA officer sees alert in dashboard                                    │
│  11. Can: Acknowledge → Start Review → Resolve/Dismiss                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Point: Detection Happens at SHA Processing, NOT at Invoice Creation

**Hospital portal:**
- Shows ALL services in dropdown (no filtering)
- No validation when adding items
- Hospital can submit any service

**Detection happens when SHA officer clicks "Process" on a RECEIVED claim.**

---

## Seed Data: Hospitals & Their Authorized Services

| Hospital | Status | Verification | Authorized Services |
|----------|--------|--------------|-------------------|
| **Nairobi General** (A) | ACTIVE | ✅ VERIFIED | CONSULTATION, MALARIA_TEST, CBC, X_RAY, SURGERY, MATERNITY, PHARMACY, EMERGENCY |
| **Coast Medical** (B) | ACTIVE | ✅ VERIFIED | CONSULTATION, MALARIA_TEST, X_RAY, PHARMACY |
| **Rift Valley** (C) | ACTIVE | ❌ UNVERIFIED | CONSULTATION, PHARMACY |
| **Western Province** (D) | ACTIVE | ✅ VERIFIED | CONSULTATION, CBC, X_RAY, ULTRASOUND, PHARMACY, EMERGENCY |
| **Highland Specialized** (E) | 🚫 SUSPENDED | ❌ REJECTED | _None (suspended)_ |

---

## Seed Data: Existing Claims

| Claim | Hospital | Diagnosis | Amount | Status | Expected Detection |
|-------|----------|----------|--------|--------|-------------------|
| CLM-2026-001 | Nairobi A | Upper respiratory infection | KES 4,500 | RECEIVED | Clean |
| CLM-2026-002 | Nairobi A | Malaria uncomplicated | KES 2,800 | ASSESSED | Clean |
| CLM-2026-003 | Nairobi A | Normal delivery | KES 35,000 | CLEARED | Clean |
| CLM-2026-004 | Coast B | Fracture | KES 8,500 | FLAGGED | R-002 + R-004 triggered |
| CLM-2026-005 | Coast B | Severe malaria | KES 12,500 | UNDER_REVIEW | R-004 + R-005 triggered |
| CLM-2026-006 | Rift Valley C | Chronic back pain | KES 1,800 | RECEIVED | R-001 triggered (unverified) |
| CLM-2026-007 | Rift Valley C | MRI lumbar spine | KES 15,000 | VALIDATING | R-001 + R-002 + R-004 triggered |
| CLM-2026-008 | Western D | Prenatal care | KES 6,500 | ASSESSED | Clean |
| CLM-2026-009 | Western D | Appendicitis surgery | KES 42,000 | FLAGGED | R-004 + AI HIGH |
| CLM-2026-010 | Highland E | General checkup | KES 950 | RECEIVED | R-001 + suspended hospital |
| CLM-2026-011 | Nairobi A | (draft) | KES 0 | DRAFT | Not yet submitted |

---

## Test Scenarios

### Test 1: Clean Claim (Should CLEAR)
**Hospital:** Nairobi General (A)
**User:** `james@nairobigen.co.ke` / `password`
**Scenario:** Submit a normal consultation claim

**Steps:**
1. Login as `james@nairobigen.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-001`, Diagnosis: `Common cold`
4. Add Item: Service: `CONSULTATION`, Qty: 1, Amount: KES 1,500
5. Submit claim
6. Note the claim reference (e.g., CLM-2026-012)
7. **Switch to SHA portal**
8. Login as `sarah@sha.go.ke` / `password`
9. Go to **Claims** → Find your new claim
10. Click **Process** (VALIDATING)
11. Click **Process** again (ANALYZING)
12. Click **Process** again (ASSESSED → CLEARED)

**Expected Result:** Claim goes to CLEARED, no alerts.

---

### Test 2: Unverified Facility (R-001)
**Hospital:** Rift Valley Clinic (C)
**User:** `peter@riftvalley.co.ke` / `password`
**Scenario:** Submit a claim from an unverified facility

**Detection Trigger:** `R-001: Facility Not Verified` (+25 points)

**Steps:**
1. Login as `peter@riftvalley.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-R001`, Diagnosis: `Headache`
4. Add Item: Service: `CONSULTATION`, Qty: 1, Amount: KES 1,000
5. Submit claim
6. Note the claim reference
7. **Switch to SHA portal**
8. Login as `sarah@sha.go.ke` / `password`
9. Go to **Claims** → Find the new claim (status: RECEIVED)
10. Click **Process** 3 times

**Expected Result:**
- R-001 triggers (unverified hospital +25)
- Claim likely FLAGGED (unless other rules also trigger and push score ≥50)
- Alert generated: "Unverified facility: Rift Valley Clinic"

---

### Test 3: Service Mismatch (R-002)
**Hospital:** Rift Valley Clinic (C)
**User:** `peter@riftvalley.co.ke` / `password`
**Scenario:** Bill for MRI at a clinic without radiology authorization

**Detection Trigger:** `R-002: Facility Service Mismatch` (+20 points)

**Rift Valley C is authorized for:** CONSULTATION, PHARMACY only

**Steps:**
1. Login as `peter@riftvalley.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-R002`, Diagnosis: `Back pain - MRI ordered`
4. Add Item: Service: `MRI`, Qty: 1, Amount: KES 15,000
   - MRI is NOT in Rift Valley's authorized services!
5. Submit claim
6. **Switch to SHA portal**
7. Process the claim 3 times

**Expected Result:**
- R-001 triggers (+25) - unverified
- R-002 triggers (+20) - MRI not authorized
- R-004 triggers (+15) - amount > KES 750,000 threshold
- Total: +60 → FLAGGED
- Alert generated: "Service mismatch: [claim ref]"

---

### Test 4: Unusual Amount (R-004)
**Hospital:** Coast Medical (B)
**User:** `amina@coastmedical.co.ke` / `password`
**Scenario:** Submit a claim with unusually high amount

**Detection Trigger:** `R-004: Unusual Claim Amount` (+15 points if > KES 750,000)

**Threshold:** KES 750,000 (3× average of KES 250,000)

**Steps:**
1. Login as `amina@coastmedical.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-R004`, Diagnosis: `Complex surgery requiring specialist`
4. Add Item: Service: `SURGERY`, Qty: 1, Amount: KES 800,000
   - Coast Medical IS authorized for SURGERY
   - But amount > threshold triggers R-004
5. Submit claim
6. **Switch to SHA portal**
7. Process the claim 3 times

**Expected Result:**
- R-004 triggers (+15) - amount exceeds threshold
- AI may add findings if amount seems suspicious
- Likely FLAGGED (score ≥ 50 with other factors)

---

### Test 5: Unusual Quantity (R-005)
**Hospital:** Coast Medical (B)
**User:** `amina@coastmedical.co.ke` / `password`
**Scenario:** Submit a claim with unusually high quantity

**Detection Trigger:** `R-005: Unusual Quantity` (+10 if any item > 10 units)

**Steps:**
1. Login as `amina@coastmedical.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-R005`, Diagnosis: `Malaria with complications`
4. Add Item: Service: `MALARIA_TEST`, Qty: 15, Amount: KES 500
   - Quantity 15 > threshold of 10
5. Submit claim
6. **Switch to SHA portal**
7. Process the claim 3 times

**Expected Result:**
- R-005 triggers (+10) - quantity exceeds 10 units
- May trigger R-004 if total > threshold
- FLAGGED or CLEARED depending on total score

---

### Test 6: Suspended Hospital (R-001 + System)
**Hospital:** Highland Specialized (E)
**User:** `david@highland.co.ke` / `password`
**Scenario:** Submit a claim from a suspended hospital

**Detection Triggers:**
- `R-001: Facility Not Verified` (+25) - verification is REJECTED
- Hospital status is SUSPENDED (additional concern)

**Steps:**
1. Login as `david@highland.co.ke`
2. Go to **Invoices** → **New Invoice**
3. Patient: `PAT-TEST-SUSPENDED`, Diagnosis: `General checkup`
4. Add Item: Service: `CONSULTATION`, Qty: 1, Amount: KES 1,000
5. Submit claim
6. **Switch to SHA portal**
7. Process the claim 3 times

**Expected Result:**
- R-001 triggers (+25) - REJECTED verification status
- Hospital is SUSPENDED (system flags this)
- Likely FLAGGED immediately
- Alert generated with HIGH severity

---

### Test 7: Verify Existing Flagged Claims
**No login needed - just browse**

**Existing Flagged Claims in Seed:**
1. **CLM-2026-004** (Coast B - Fracture)
   - Risk Score: 55 (HIGH)
   - Triggers: R-002 (service mismatch), R-004 (amount)
   - Status: FLAGGED
   - Alert: "High risk claim"

2. **CLM-2026-009** (Western D - Appendicitis)
   - Risk Score: 65 (HIGH)
   - Triggers: R-004 (amount KES 42,000), AI finding
   - Status: FLAGGED
   - Alert: "High risk claim"

**Steps:**
1. Login as `sarah@sha.go.ke` / `password`
2. Go to **Alerts** — See all open alerts
3. Click an alert → View claim details
4. See findings, risk score, contributors
5. Actions: Acknowledge → Start Review → Resolve/Dismiss

---

## Compliance Rules Reference

| Code | Name | Trigger | Score | Severity |
|------|------|---------|-------|----------|
| R-001 | Facility Not Verified | `verificationStatus ≠ VERIFIED` | +25 | HIGH |
| R-002 | Facility Service Mismatch | Service not in hospital's authorized list | +20 | HIGH |
| R-003 | Duplicate Claim | (not implemented) | +30 | CRITICAL |
| R-004 | Unusual Claim Amount | `total > KES 750,000` | +15 | MEDIUM |
| R-005 | Unusual Quantity | `any item qty > 10` | +10 | MEDIUM |
| R-006 | Diagnosis Mismatch | (not implemented) | +20 | HIGH |

### Risk Levels

| Score | Level | Action |
|-------|-------|--------|
| 0-24 | LOW | CLEARED |
| 25-49 | MODERATE | CLEARED |
| 50-74 | HIGH | FLAGGED |
| 75-100 | CRITICAL | FLAGGED |

---

## Demo Accounts

| Email | Password | Role | Hospital |
|-------|----------|------|----------|
| `james@nairobigen.co.ke` | password | HOSPITAL_USER | Nairobi General (A) |
| `amina@coastmedical.co.ke` | password | HOSPITAL_USER | Coast Medical (B) |
| `peter@riftvalley.co.ke` | password | HOSPITAL_USER | Rift Valley (C) |
| `grace@westernprov.co.ke` | password | HOSPITAL_USER | Western Province (D) |
| `david@highland.co.ke` | password | HOSPITAL_USER | Highland (E) |
| `sarah@sha.go.ke` | password | SHA_OFFICER | — |
| `michael@sha.go.ke` | password | SHA_OFFICER | — |
| `admin@sha.go.ke` | password | ADMIN | — |

---

## Quick Test Summary

| Test | Hospital | What to Bill | Expected Detection |
|------|----------|--------------|-------------------|
| Clean | Nairobi A | CONSULTATION KES 1,500 | None - CLEARED |
| Unverified | Rift Valley C | CONSULTATION KES 1,000 | R-001 |
| Service Mismatch | Rift Valley C | MRI KES 15,000 | R-001 + R-002 + R-004 |
| High Amount | Coast B | SURGERY KES 800,000 | R-004 |
| High Quantity | Coast B | MALARIA_TEST qty 15 | R-005 |
| Suspended | Highland E | CONSULTATION KES 1,000 | R-001 + suspended |
