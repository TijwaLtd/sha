import "dotenv/config"
import { PrismaClient } from "../app/generated/prisma/client"
import {
  UserRole,
  HospitalStatus,
  VerificationStatus,
  ClaimStatus,
  ClaimSource,
  FindingSeverity,
  FindingSource,
  RiskLevel,
  ReviewStatus,
  ReviewOutcome,
  AiAnalysisStatus,
  EquipmentStatus,
  EncounterType,
  DayOfWeek,
} from "../app/generated/prisma/enums"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ─── Helpers ─────────────────────────────────────────
const kes = (amount: number) => Math.round(amount * 100) // KES -> cents
const AMOUNT_THRESHOLD_CENTS = kes(750_000) // R-004 trigger point
const QTY_THRESHOLD = 10 // R-005 trigger point (qty > 10)
const DUPLICATE_WINDOW_DAYS = 5 // R-003 / R-007 lookback window

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL
  if (score >= 50) return RiskLevel.HIGH
  if (score >= 25) return RiskLevel.MODERATE
  return RiskLevel.LOW
}

function daysAfter(iso: string, n: number): string {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString()
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
}

// ─── Service catalogue (unchanged — level-based, not hospital-count-based) ──
type ServiceDef = {
  code: string
  name: string
  description: string
  category: string
  serviceType:
    | "DIAGNOSTIC" | "THERAPEUTIC" | "SURGICAL" | "LABORATORY" | "RADIOLOGY"
    | "PHARMACY" | "PREVENTIVE" | "REHABILITATION" | "MENTAL_HEALTH" | "DENTAL"
    | "OPTICAL" | "OTHER"
  isInpatient?: boolean
  isEmergency?: boolean
}

const SERVICE_DEFS: ServiceDef[] = [
  { code: "CONSULTATION", name: "General Consultation", description: "Outpatient consultation with physician", category: "OUTPATIENT", serviceType: "DIAGNOSTIC" },
  { code: "SPECIALIST_CONSULT", name: "Specialist Consultation", description: "Consultation with a specialist physician", category: "OUTPATIENT", serviceType: "DIAGNOSTIC" },
  { code: "MALARIA_TEST", name: "Malaria Test", description: "Rapid diagnostic test for malaria", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "CBC", name: "Complete Blood Count", description: "Full blood count laboratory test", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "URINALYSIS", name: "Urinalysis", description: "Urine laboratory analysis", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "BLOOD_CHEM", name: "Blood Chemistry Panel", description: "Metabolic/electrolyte blood panel", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "HIV_TEST", name: "HIV Testing & Counselling", description: "HIV rapid test with counselling", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "TB_SCREEN", name: "TB Screening (GeneXpert)", description: "Molecular TB screening test", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "BLOOD_GROUP", name: "Blood Grouping & Crossmatch", description: "Blood typing and crossmatch", category: "LABORATORY", serviceType: "LABORATORY" },
  { code: "X_RAY", name: "X-Ray", description: "Radiographic imaging", category: "RADIOLOGY", serviceType: "RADIOLOGY" },
  { code: "ULTRASOUND", name: "Ultrasound", description: "Diagnostic ultrasound imaging", category: "RADIOLOGY", serviceType: "RADIOLOGY" },
  { code: "CT_SCAN", name: "CT Scan", description: "Computed tomography imaging", category: "RADIOLOGY", serviceType: "RADIOLOGY" },
  { code: "MRI", name: "MRI Scan", description: "Magnetic Resonance Imaging", category: "RADIOLOGY", serviceType: "RADIOLOGY" },
  { code: "SURGERY_MINOR", name: "Minor Surgery", description: "Minor surgical procedure", category: "SURGERY", serviceType: "SURGICAL" },
  { code: "SURGERY_MAJOR", name: "Major Surgery", description: "Major surgical procedure", category: "SURGERY", serviceType: "SURGICAL", isInpatient: true },
  { code: "ORTHO_SURGERY", name: "Orthopedic Surgery", description: "Bone/joint surgical procedure", category: "SURGERY", serviceType: "SURGICAL", isInpatient: true },
  { code: "ANC", name: "Antenatal Care", description: "Antenatal check-up and monitoring", category: "MATERNITY", serviceType: "PREVENTIVE" },
  { code: "DELIVERY_NORMAL", name: "Normal Delivery", description: "Vaginal delivery care", category: "MATERNITY", serviceType: "THERAPEUTIC", isInpatient: true },
  { code: "DELIVERY_CS", name: "Caesarean Section", description: "Surgical delivery", category: "MATERNITY", serviceType: "SURGICAL", isInpatient: true },
  { code: "POSTNATAL", name: "Postnatal Care", description: "Post-delivery follow-up care", category: "MATERNITY", serviceType: "THERAPEUTIC" },
  { code: "DENTAL", name: "Dental Services", description: "Dental examination and treatment", category: "DENTAL", serviceType: "DENTAL" },
  { code: "PHARMACY", name: "Pharmacy", description: "Dispensing of medication", category: "PHARMACY", serviceType: "PHARMACY" },
  { code: "EMERGENCY", name: "Emergency Services", description: "Emergency medical care", category: "EMERGENCY", serviceType: "THERAPEUTIC", isEmergency: true },
  { code: "AMBULANCE", name: "Ambulance Services", description: "Emergency patient transport", category: "EMERGENCY", serviceType: "THERAPEUTIC", isEmergency: true },
  { code: "ICU", name: "Intensive Care Unit", description: "Critical care admission, per day", category: "CRITICAL_CARE", serviceType: "THERAPEUTIC", isInpatient: true },
  { code: "DIALYSIS", name: "Renal Dialysis", description: "Dialysis session", category: "CRITICAL_CARE", serviceType: "THERAPEUTIC" },
  { code: "CHEMOTHERAPY", name: "Chemotherapy", description: "Chemotherapy session", category: "ONCOLOGY", serviceType: "THERAPEUTIC" },
  { code: "PHYSIOTHERAPY", name: "Physiotherapy", description: "Physiotherapy session", category: "PHYSIOTHERAPY", serviceType: "REHABILITATION" },
  { code: "MENTAL_HEALTH", name: "Mental Health Services", description: "Mental health outpatient session", category: "MENTAL_HEALTH", serviceType: "MENTAL_HEALTH" },
  { code: "FAMILY_PLANNING", name: "Family Planning", description: "Family planning services", category: "PREVENTIVE", serviceType: "PREVENTIVE" },
  { code: "IMMUNIZATION", name: "Immunization", description: "Vaccination services", category: "PREVENTIVE", serviceType: "PREVENTIVE" },
  { code: "OPTICAL", name: "Eye Clinic", description: "Optical/eye clinic services", category: "OPTICAL", serviceType: "OPTICAL" },
]
const ALL_SERVICE_CODES = SERVICE_DEFS.map((s) => s.code)

// ─── Compliance rules ────────────────────────────────
type RuleDef = {
  code: string
  name: string
  description: string
  category: string
  severity: FindingSeverity
  scoreContribution: number
}
type RuleWithId = RuleDef & { id: string }

const RULE_DEFS: RuleDef[] = [
  { code: "R-001", name: "Facility Not Verified", description: "Claim submitted by unverified facility", category: "FACILITY", severity: FindingSeverity.HIGH, scoreContribution: 50 },
  { code: "R-002", name: "Facility Service Mismatch", description: "Claimed service not in facility capabilities", category: "FACILITY", severity: FindingSeverity.HIGH, scoreContribution: 50 },
  { code: "R-003", name: "Duplicate Claim", description: "Same patient billed for the same service at the same facility within the review window", category: "CLAIM", severity: FindingSeverity.CRITICAL, scoreContribution: 30 },
  { code: "R-004", name: "Unusual Claim Amount", description: "Claim amount above KES 750,000", category: "AMOUNT", severity: FindingSeverity.MEDIUM, scoreContribution: 15 },
  { code: "R-005", name: "Unusual Quantity", description: "A line item quantity exceeds 10", category: "AMOUNT", severity: FindingSeverity.MEDIUM, scoreContribution: 10 },
  { code: "R-006", name: "Diagnosis Mismatch", description: "Service does not match claimed diagnosis", category: "CLINICAL", severity: FindingSeverity.HIGH, scoreContribution: 20 },
  { code: "R-007", name: "Cross-Facility Duplicate Billing", description: "Same patient billed for the same service at a different facility within the review window", category: "CLAIM", severity: FindingSeverity.CRITICAL, scoreContribution: 35 },
]

// ─── Facility Levels ──────────────────────────────────
type FacilityLevelDef = { code: string; name: string; description: string; rank: number }
const FACILITY_LEVEL_DEFS: FacilityLevelDef[] = [
  { code: "DISPENSARY", name: "Dispensary", description: "Basic healthcare facility providing outpatient services", rank: 1 },
  { code: "HEALTH_CENTER", name: "Health Centre", description: "Primary care facility with basic inpatient services", rank: 2 },
  { code: "SUB_COUNTY_HOSPITAL", name: "Sub-County Hospital", description: "Referral facility serving a sub-county with basic surgical services", rank: 3 },
  { code: "COUNTY_REFERRAL", name: "County Referral Hospital", description: "County-level referral hospital with specialist services", rank: 4 },
  { code: "NATIONAL_REFERRAL", name: "National Referral Hospital", description: "National-level referral hospital with full range of services", rank: 5 },
]

// ─── Equipment / Staff types ──────────────────────────
type EquipmentTypeDef = { code: string; name: string; description: string; category: string }
const EQUIPMENT_TYPE_DEFS: EquipmentTypeDef[] = [
  { code: "MRI_SCANNER", name: "MRI Scanner", description: "Magnetic Resonance Imaging scanner", category: "IMAGING" },
  { code: "CT_SCANNER", name: "CT Scanner", description: "Computed Tomography scanner", category: "IMAGING" },
  { code: "X_RAY_MACHINE", name: "X-Ray Machine", description: "Radiographic imaging machine", category: "IMAGING" },
  { code: "ULTRASOUND", name: "Ultrasound Machine", description: "Diagnostic ultrasound machine", category: "IMAGING" },
  { code: "DIALYSIS_MACHINE", name: "Dialysis Machine", description: "Renal dialysis machine", category: "THERAPEUTIC" },
  { code: "VENTILATOR", name: "Ventilator", description: "Mechanical ventilation machine", category: "CRITICAL_CARE" },
  { code: "DEFIBRILLATOR", name: "Defibrillator", description: "Automated external defibrillator", category: "EMERGENCY" },
]

type StaffTypeDef = { code: string; name: string; description: string; category: string }
const STAFF_TYPE_DEFS: StaffTypeDef[] = [
  { code: "PHYSICIAN", name: "Physician", description: "Medical doctor / general practitioner", category: "CLINICAL" },
  { code: "SPECIALIST", name: "Specialist", description: "Specialist physician", category: "CLINICAL" },
  { code: "NURSE", name: "Nurse", description: "Registered nurse", category: "NURSING" },
  { code: "LAB_TECHNICIAN", name: "Laboratory Technician", description: "Laboratory technologist / technician", category: "LABORATORY" },
  { code: "RADIOGRAPHER", name: "Radiographer", description: "Radiology technologist", category: "RADIOLOGY" },
  { code: "PHARMACIST", name: "Pharmacist", description: "Licensed pharmacist", category: "PHARMACY" },
  { code: "SURGEON", name: "Surgeon", description: "Surgical specialist", category: "SURGICAL" },
  { code: "ANAESTHETIST", name: "Anaesthetist", description: "Anaesthesia specialist", category: "SURGICAL" },
]

// ─── Service Requirements (unchanged) ────────────────
type ServiceRequirementDef = { serviceCode: string; requirementType: string; requirementCode: string; isRequired: boolean; notes?: string }
const SERVICE_REQUIREMENT_DEFS: ServiceRequirementDef[] = [
  { serviceCode: "MRI", requirementType: "EQUIPMENT", requirementCode: "MRI_SCANNER", isRequired: true, notes: "MRI scan requires MRI scanner" },
  { serviceCode: "CT_SCAN", requirementType: "EQUIPMENT", requirementCode: "CT_SCANNER", isRequired: true, notes: "CT scan requires CT scanner" },
  { serviceCode: "X_RAY", requirementType: "EQUIPMENT", requirementCode: "X_RAY_MACHINE", isRequired: true, notes: "X-ray requires X-ray machine" },
  { serviceCode: "ULTRASOUND", requirementType: "EQUIPMENT", requirementCode: "ULTRASOUND", isRequired: true, notes: "Ultrasound requires ultrasound machine" },
  { serviceCode: "DIALYSIS", requirementType: "EQUIPMENT", requirementCode: "DIALYSIS_MACHINE", isRequired: true, notes: "Dialysis requires dialysis machine" },
  { serviceCode: "ICU", requirementType: "EQUIPMENT", requirementCode: "VENTILATOR", isRequired: true, notes: "ICU requires ventilator" },
  { serviceCode: "ICU", requirementType: "EQUIPMENT", requirementCode: "DEFIBRILLATOR", isRequired: true, notes: "ICU requires defibrillator" },
  { serviceCode: "EMERGENCY", requirementType: "EQUIPMENT", requirementCode: "DEFIBRILLATOR", isRequired: true, notes: "Emergency services require defibrillator" },
  { serviceCode: "SURGERY_MAJOR", requirementType: "STAFF", requirementCode: "SURGEON", isRequired: true, notes: "Major surgery requires surgeon" },
  { serviceCode: "SURGERY_MAJOR", requirementType: "STAFF", requirementCode: "ANAESTHETIST", isRequired: true, notes: "Major surgery requires anaesthetist" },
  { serviceCode: "SURGERY_MINOR", requirementType: "STAFF", requirementCode: "SURGEON", isRequired: true, notes: "Minor surgery requires surgeon" },
  { serviceCode: "DELIVERY_CS", requirementType: "STAFF", requirementCode: "SURGEON", isRequired: true, notes: "Caesarean section requires surgeon" },
  { serviceCode: "DELIVERY_CS", requirementType: "STAFF", requirementCode: "ANAESTHETIST", isRequired: true, notes: "Caesarean section requires anaesthetist" },
  { serviceCode: "CHEMOTHERAPY", requirementType: "STAFF", requirementCode: "SPECIALIST", isRequired: true, notes: "Chemotherapy requires oncologist" },
  { serviceCode: "MALARIA_TEST", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "Malaria test requires lab technician" },
  { serviceCode: "CBC", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "CBC requires lab technician" },
  { serviceCode: "URINALYSIS", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "Urinalysis requires lab technician" },
  { serviceCode: "BLOOD_CHEM", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "Blood chemistry requires lab technician" },
  { serviceCode: "HIV_TEST", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "HIV test requires lab technician" },
  { serviceCode: "TB_SCREEN", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "TB screening requires lab technician" },
  { serviceCode: "BLOOD_GROUP", requirementType: "STAFF", requirementCode: "LAB_TECHNICIAN", isRequired: true, notes: "Blood grouping requires lab technician" },
  { serviceCode: "X_RAY", requirementType: "STAFF", requirementCode: "RADIOGRAPHER", isRequired: true, notes: "X-ray requires radiographer" },
  { serviceCode: "CT_SCAN", requirementType: "STAFF", requirementCode: "RADIOGRAPHER", isRequired: true, notes: "CT scan requires radiographer" },
  { serviceCode: "MRI", requirementType: "STAFF", requirementCode: "RADIOGRAPHER", isRequired: true, notes: "MRI requires radiographer" },
  { serviceCode: "PHARMACY", requirementType: "STAFF", requirementCode: "PHARMACIST", isRequired: true, notes: "Pharmacy requires pharmacist" },
]

// ─── Billing Policies (unchanged) ────────────────────
type BillingPolicyDef = { facilityLevelCode: string; serviceCode?: string; maxPerEncounter?: number; maxPerService?: number; maxQtyPerService?: number; maxDailyAmount?: number }
const BILLING_POLICY_DEFS: BillingPolicyDef[] = [
  { facilityLevelCode: "DISPENSARY", maxPerEncounter: kes(10_000), maxPerService: kes(5_000), maxQtyPerService: 5, maxDailyAmount: kes(15_000) },
  { facilityLevelCode: "HEALTH_CENTER", maxPerEncounter: kes(50_000), maxPerService: kes(30_000), maxQtyPerService: 10, maxDailyAmount: kes(75_000) },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", maxPerEncounter: kes(200_000), maxPerService: kes(100_000), maxQtyPerService: 20, maxDailyAmount: kes(300_000) },
  { facilityLevelCode: "COUNTY_REFERRAL", maxPerEncounter: kes(500_000), maxPerService: kes(200_000), maxQtyPerService: 30, maxDailyAmount: kes(600_000) },
  { facilityLevelCode: "NATIONAL_REFERRAL", maxPerEncounter: kes(2_000_000), maxPerService: kes(1_000_000), maxQtyPerService: 50, maxDailyAmount: kes(2_500_000) },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "SURGERY_MAJOR", maxPerEncounter: kes(200_000), maxQtyPerService: 3 },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "SURGERY_MAJOR", maxPerEncounter: kes(500_000), maxQtyPerService: 5 },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "ICU", maxPerEncounter: kes(300_000), maxQtyPerService: 30, maxDailyAmount: kes(30_000) },
]

// ─── Service Tariffs (unchanged) ─────────────────────
type ServiceTariffDef = { serviceCode: string; facilityLevelCode: string; unitAmountKes: number; minAmountKes?: number; maxAmountKes?: number }
const SERVICE_TARIFF_DEFS: ServiceTariffDef[] = [
  { serviceCode: "CONSULTATION", facilityLevelCode: "DISPENSARY", unitAmountKes: 150, minAmountKes: 100, maxAmountKes: 300 },
  { serviceCode: "CONSULTATION", facilityLevelCode: "HEALTH_CENTER", unitAmountKes: 200, minAmountKes: 150, maxAmountKes: 500 },
  { serviceCode: "CONSULTATION", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 500, minAmountKes: 300, maxAmountKes: 1500 },
  { serviceCode: "CONSULTATION", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 1000, minAmountKes: 500, maxAmountKes: 2000 },
  { serviceCode: "CONSULTATION", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 2000, minAmountKes: 1000, maxAmountKes: 3000 },
  { serviceCode: "MALARIA_TEST", facilityLevelCode: "DISPENSARY", unitAmountKes: 200, minAmountKes: 100, maxAmountKes: 500 },
  { serviceCode: "MALARIA_TEST", facilityLevelCode: "HEALTH_CENTER", unitAmountKes: 300, minAmountKes: 150, maxAmountKes: 500 },
  { serviceCode: "MALARIA_TEST", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 500, minAmountKes: 300, maxAmountKes: 800 },
  { serviceCode: "CBC", facilityLevelCode: "HEALTH_CENTER", unitAmountKes: 300, minAmountKes: 200, maxAmountKes: 500 },
  { serviceCode: "CBC", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 500, minAmountKes: 300, maxAmountKes: 800 },
  { serviceCode: "X_RAY", facilityLevelCode: "HEALTH_CENTER", unitAmountKes: 1000, minAmountKes: 500, maxAmountKes: 1500 },
  { serviceCode: "X_RAY", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 1500, minAmountKes: 1000, maxAmountKes: 2500 },
  { serviceCode: "X_RAY", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 2000, minAmountKes: 1000, maxAmountKes: 3000 },
  { serviceCode: "CT_SCAN", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 8000, minAmountKes: 5000, maxAmountKes: 15000 },
  { serviceCode: "CT_SCAN", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 10000, minAmountKes: 5000, maxAmountKes: 15000 },
  { serviceCode: "MRI", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 15000, minAmountKes: 10000, maxAmountKes: 25000 },
  { serviceCode: "MRI", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 15000, minAmountKes: 10000, maxAmountKes: 25000 },
  { serviceCode: "SURGERY_MAJOR", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 100000, minAmountKes: 50000, maxAmountKes: 200000 },
  { serviceCode: "SURGERY_MAJOR", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 200000, minAmountKes: 100000, maxAmountKes: 500000 },
  { serviceCode: "SURGERY_MAJOR", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 400000, minAmountKes: 100000, maxAmountKes: 1000000 },
  { serviceCode: "ICU", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 15000, minAmountKes: 10000, maxAmountKes: 25000 },
  { serviceCode: "ICU", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 20000, minAmountKes: 10000, maxAmountKes: 30000 },
  { serviceCode: "DIALYSIS", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 8000, minAmountKes: 5000, maxAmountKes: 12000 },
  { serviceCode: "DIALYSIS", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 10000, minAmountKes: 5000, maxAmountKes: 15000 },
  { serviceCode: "CHEMOTHERAPY", facilityLevelCode: "NATIONAL_REFERRAL", unitAmountKes: 50000, minAmountKes: 30000, maxAmountKes: 100000 },
  { serviceCode: "DELIVERY_NORMAL", facilityLevelCode: "HEALTH_CENTER", unitAmountKes: 20000, minAmountKes: 10000, maxAmountKes: 30000 },
  { serviceCode: "DELIVERY_NORMAL", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 30000, minAmountKes: 15000, maxAmountKes: 50000 },
  { serviceCode: "DELIVERY_CS", facilityLevelCode: "SUB_COUNTY_HOSPITAL", unitAmountKes: 25000, minAmountKes: 15000, maxAmountKes: 50000 },
  { serviceCode: "DELIVERY_CS", facilityLevelCode: "COUNTY_REFERRAL", unitAmountKes: 40000, minAmountKes: 20000, maxAmountKes: 80000 },
]

// ─── Facility Level Capabilities (unchanged) ─────────
type FacilityLevelCapabilityDef = { facilityLevelCode: string; serviceCode: string; isExpected: boolean; isAllowed: boolean; requiresAccreditation: boolean }
const FACILITY_LEVEL_CAPABILITY_DEFS: FacilityLevelCapabilityDef[] = [
  { facilityLevelCode: "DISPENSARY", serviceCode: "CONSULTATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "PHARMACY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "IMMUNIZATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "FAMILY_PLANNING", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "MALARIA_TEST", isExpected: false, isAllowed: true, requiresAccreditation: false },

  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "CONSULTATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "PHARMACY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "MALARIA_TEST", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "CBC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "URINALYSIS", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "X_RAY", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "ULTRASOUND", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "ANC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "DELIVERY_NORMAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "IMMUNIZATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "FAMILY_PLANNING", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "HEALTH_CENTER", serviceCode: "POSTNATAL", isExpected: true, isAllowed: true, requiresAccreditation: false },

  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "CONSULTATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "SPECIALIST_CONSULT", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "PHARMACY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "MALARIA_TEST", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "CBC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "URINALYSIS", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "BLOOD_CHEM", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "X_RAY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "ULTRASOUND", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "ANC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "DELIVERY_NORMAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "DELIVERY_CS", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "POSTNATAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "SURGERY_MINOR", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "DENTAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "EMERGENCY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "CT_SCAN", isExpected: false, isAllowed: false, requiresAccreditation: true },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "MRI", isExpected: false, isAllowed: false, requiresAccreditation: true },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "SURGERY_MAJOR", isExpected: false, isAllowed: false, requiresAccreditation: true },
  { facilityLevelCode: "SUB_COUNTY_HOSPITAL", serviceCode: "ICU", isExpected: false, isAllowed: false, requiresAccreditation: true },

  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "CONSULTATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "SPECIALIST_CONSULT", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "PHARMACY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "MALARIA_TEST", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "CBC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "URINALYSIS", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "BLOOD_CHEM", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "HIV_TEST", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "TB_SCREEN", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "BLOOD_GROUP", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "X_RAY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "ULTRASOUND", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "CT_SCAN", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "MRI", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "SURGERY_MINOR", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "SURGERY_MAJOR", isExpected: true, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "ORTHO_SURGERY", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "ANC", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "DELIVERY_NORMAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "DELIVERY_CS", isExpected: true, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "POSTNATAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "DENTAL", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "EMERGENCY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "AMBULANCE", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "ICU", isExpected: true, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "CHEMOTHERAPY", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "DIALYSIS", isExpected: false, isAllowed: true, requiresAccreditation: true },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "PHYSIOTHERAPY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "COUNTY_REFERRAL", serviceCode: "MENTAL_HEALTH", isExpected: true, isAllowed: true, requiresAccreditation: false },

  ...ALL_SERVICE_CODES.map((code) => ({
    facilityLevelCode: "NATIONAL_REFERRAL",
    serviceCode: code,
    isExpected: true,
    isAllowed: true,
    requiresAccreditation: false,
  })),
]

function servicesForLevel(levelCode: string): string[] {
  return FACILITY_LEVEL_CAPABILITY_DEFS.filter((c) => c.facilityLevelCode === levelCode && c.isAllowed).map((c) => c.serviceCode)
}

// ─── Per-level equipment / staff / hours / capacity templates ─
type EquipTemplateItem = { code: string; qty: number; status?: EquipmentStatus; notes?: string }
const LEVEL_EQUIPMENT_TEMPLATE: Record<string, EquipTemplateItem[]> = {
  DISPENSARY: [],
  HEALTH_CENTER: [
    { code: "ULTRASOUND", qty: 1 },
    { code: "DEFIBRILLATOR", qty: 1 },
  ],
  SUB_COUNTY_HOSPITAL: [
    { code: "X_RAY_MACHINE", qty: 1 },
    { code: "ULTRASOUND", qty: 1 },
    { code: "CT_SCANNER", qty: 1 },
    { code: "VENTILATOR", qty: 2 },
    { code: "DEFIBRILLATOR", qty: 1 },
  ],
  COUNTY_REFERRAL: [
    { code: "X_RAY_MACHINE", qty: 3 },
    { code: "ULTRASOUND", qty: 2 },
    { code: "CT_SCANNER", qty: 1 },
    { code: "MRI_SCANNER", qty: 1 },
    { code: "DIALYSIS_MACHINE", qty: 2 },
    { code: "VENTILATOR", qty: 5 },
    { code: "DEFIBRILLATOR", qty: 2 },
  ],
  NATIONAL_REFERRAL: [
    { code: "MRI_SCANNER", qty: 2 },
    { code: "CT_SCANNER", qty: 3 },
    { code: "X_RAY_MACHINE", qty: 4 },
    { code: "ULTRASOUND", qty: 3 },
    { code: "DIALYSIS_MACHINE", qty: 5 },
    { code: "VENTILATOR", qty: 10 },
    { code: "DEFIBRILLATOR", qty: 5 },
  ],
}

type StaffTemplateItem = { code: string; qty: number }
const LEVEL_STAFF_TEMPLATE: Record<string, StaffTemplateItem[]> = {
  DISPENSARY: [
    { code: "PHYSICIAN", qty: 1 },
    { code: "NURSE", qty: 2 },
    { code: "PHARMACIST", qty: 1 },
  ],
  HEALTH_CENTER: [
    { code: "PHYSICIAN", qty: 2 },
    { code: "NURSE", qty: 4 },
    { code: "LAB_TECHNICIAN", qty: 1 },
    { code: "PHARMACIST", qty: 1 },
  ],
  SUB_COUNTY_HOSPITAL: [
    { code: "PHYSICIAN", qty: 4 },
    { code: "SPECIALIST", qty: 2 },
    { code: "NURSE", qty: 10 },
    { code: "LAB_TECHNICIAN", qty: 2 },
    { code: "RADIOGRAPHER", qty: 1 },
    { code: "PHARMACIST", qty: 2 },
    { code: "SURGEON", qty: 1 },
    { code: "ANAESTHETIST", qty: 1 },
  ],
  COUNTY_REFERRAL: [
    { code: "PHYSICIAN", qty: 8 },
    { code: "SPECIALIST", qty: 6 },
    { code: "NURSE", qty: 25 },
    { code: "LAB_TECHNICIAN", qty: 4 },
    { code: "RADIOGRAPHER", qty: 3 },
    { code: "PHARMACIST", qty: 3 },
    { code: "SURGEON", qty: 3 },
    { code: "ANAESTHETIST", qty: 2 },
  ],
  NATIONAL_REFERRAL: [
    { code: "PHYSICIAN", qty: 20 },
    { code: "SPECIALIST", qty: 30 },
    { code: "NURSE", qty: 80 },
    { code: "LAB_TECHNICIAN", qty: 10 },
    { code: "RADIOGRAPHER", qty: 6 },
    { code: "PHARMACIST", qty: 8 },
    { code: "SURGEON", qty: 10 },
    { code: "ANAESTHETIST", qty: 6 },
  ],
}

type OperatingHoursDef = { dayOfWeek: DayOfWeek; isOpen: boolean; openTime: string | null; closeTime: string | null; hasEmergency: boolean; is24Hour: boolean }
const WEEKDAY_ONLY: OperatingHoursDef[] = [
  { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: "08:00", closeTime: "13:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.SUNDAY, isOpen: false, openTime: null, closeTime: null, hasEmergency: false, is24Hour: false },
]
const WEEKDAY_WITH_SUNDAY_EMERGENCY: OperatingHoursDef[] = [
  { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: "08:00", closeTime: "13:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.SUNDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
]
const FULL_24_7: OperatingHoursDef[] = (Object.values(DayOfWeek) as DayOfWeek[]).map((d) => ({
  dayOfWeek: d, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true,
}))
const LEVEL_HOURS_TEMPLATE: Record<string, OperatingHoursDef[]> = {
  DISPENSARY: WEEKDAY_ONLY,
  HEALTH_CENTER: WEEKDAY_ONLY,
  SUB_COUNTY_HOSPITAL: WEEKDAY_WITH_SUNDAY_EMERGENCY,
  COUNTY_REFERRAL: WEEKDAY_WITH_SUNDAY_EMERGENCY,
  NATIONAL_REFERRAL: FULL_24_7,
}

type CapacityTemplateItem = { serviceCode: string; theoreticalDailyCapacity: number; operationalDailyCapacity: number; weeklyCapacity: number; monthlyCapacity: number; averageProcedureDurationMinutes: number; capacityBasis: "EQUIPMENT" | "STAFF" | "ROOMS" | "HOURS" | "MANUAL" }
const LEVEL_CAPACITY_TEMPLATE: Record<string, CapacityTemplateItem[]> = {
  DISPENSARY: [],
  HEALTH_CENTER: [
    { serviceCode: "CONSULTATION", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 20, capacityBasis: "STAFF" },
  ],
  SUB_COUNTY_HOSPITAL: [
    { serviceCode: "X_RAY", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 15, capacityBasis: "EQUIPMENT" },
    { serviceCode: "CT_SCAN", theoreticalDailyCapacity: 8, operationalDailyCapacity: 7, weeklyCapacity: 40, monthlyCapacity: 160, averageProcedureDurationMinutes: 30, capacityBasis: "EQUIPMENT" },
    { serviceCode: "SURGERY_MINOR", theoreticalDailyCapacity: 4, operationalDailyCapacity: 3, weeklyCapacity: 20, monthlyCapacity: 80, averageProcedureDurationMinutes: 60, capacityBasis: "STAFF" },
  ],
  COUNTY_REFERRAL: [
    { serviceCode: "CT_SCAN", theoreticalDailyCapacity: 15, operationalDailyCapacity: 12, weeklyCapacity: 75, monthlyCapacity: 300, averageProcedureDurationMinutes: 30, capacityBasis: "EQUIPMENT" },
    { serviceCode: "SURGERY_MAJOR", theoreticalDailyCapacity: 5, operationalDailyCapacity: 4, weeklyCapacity: 25, monthlyCapacity: 100, averageProcedureDurationMinutes: 240, capacityBasis: "STAFF" },
    { serviceCode: "ICU", theoreticalDailyCapacity: 15, operationalDailyCapacity: 15, weeklyCapacity: 105, monthlyCapacity: 450, averageProcedureDurationMinutes: 1440, capacityBasis: "ROOMS" },
  ],
  NATIONAL_REFERRAL: [
    { serviceCode: "MRI", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 45, capacityBasis: "EQUIPMENT" },
    { serviceCode: "CT_SCAN", theoreticalDailyCapacity: 30, operationalDailyCapacity: 28, weeklyCapacity: 150, monthlyCapacity: 600, averageProcedureDurationMinutes: 30, capacityBasis: "EQUIPMENT" },
    { serviceCode: "ICU", theoreticalDailyCapacity: 40, operationalDailyCapacity: 38, weeklyCapacity: 280, monthlyCapacity: 1200, averageProcedureDurationMinutes: 1440, capacityBasis: "ROOMS" },
  ],
}

// ─── 15 hospitals — 3 per facility level ──────────────
type HospitalDef = {
  facilityIdentifier: string
  name: string
  county: string
  address: string
  facilityLevel: string
  status: HospitalStatus
  verificationStatus: VerificationStatus
  userName: string
  userEmail: string
}

const HOSPITAL_DEFS: HospitalDef[] = [
  // ── Dispensaries (Level 1) ──
  { facilityIdentifier: "FAC-10001", name: "Kibera Community Dispensary", county: "Nairobi", address: "Kibera Drive", facilityLevel: "DISPENSARY", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.UNVERIFIED, userName: "Faith Nyambura", userEmail: "faith@kiberadispensary.co.ke" },
  { facilityIdentifier: "FAC-10002", name: "Kitale Central Dispensary", county: "Trans-Nzoia", address: "Kitale-Kapenguria Road", facilityLevel: "DISPENSARY", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Peter Wanyonyi", userEmail: "peter@kitaledispensary.co.ke" },
  { facilityIdentifier: "FAC-10003", name: "Bungoma Rural Dispensary", county: "Bungoma", address: "Chwele Road", facilityLevel: "DISPENSARY", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.PENDING, userName: "Grace Nafula", userEmail: "grace@bungomadispensary.co.ke" },

  // ── Health Centres (Level 2) ──
  { facilityIdentifier: "FAC-20001", name: "Machakos Town Health Centre", county: "Machakos", address: "Kangundo Road", facilityLevel: "HEALTH_CENTER", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Josephine Wambui", userEmail: "josephine@machakoshc.co.ke" },
  { facilityIdentifier: "FAC-20002", name: "Kakamega Health Centre", county: "Kakamega", address: "Sudi Road", facilityLevel: "HEALTH_CENTER", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Mercy Shikuku", userEmail: "mercy@kakamegahc.co.ke" },
  { facilityIdentifier: "FAC-20003", name: "Lamu Island Health Centre", county: "Lamu", address: "Harambee Avenue", facilityLevel: "HEALTH_CENTER", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.UNVERIFIED, userName: "Mercy Auma", userEmail: "mercy@lamuhc.co.ke" },

  // ── Sub-County Hospitals (Level 3) ──
  { facilityIdentifier: "FAC-30001", name: "Kiambu Sub-County Hospital", county: "Kiambu", address: "Thika Road", facilityLevel: "SUB_COUNTY_HOSPITAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Daniel Kamau", userEmail: "daniel@kiambuscsh.go.ke" },
  { facilityIdentifier: "FAC-30002", name: "Machakos Sub-County Hospital", county: "Machakos", address: "Mombasa Road", facilityLevel: "SUB_COUNTY_HOSPITAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Grace Otieno", userEmail: "grace@machakosscsh.go.ke" },
  { facilityIdentifier: "FAC-30003", name: "Siaya Sub-County Hospital", county: "Siaya", address: "Bondo Road", facilityLevel: "SUB_COUNTY_HOSPITAL", status: HospitalStatus.SUSPENDED, verificationStatus: VerificationStatus.REJECTED, userName: "David Mutua", userEmail: "david@siayascsh.go.ke" },

  // ── County Referral Hospitals (Level 4) ──
  { facilityIdentifier: "FAC-40001", name: "Nakuru County Referral Hospital", county: "Nakuru", address: "Kenyatta Avenue", facilityLevel: "COUNTY_REFERRAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Esther Chebet", userEmail: "esther@nakurureferral.go.ke" },
  { facilityIdentifier: "FAC-40002", name: "Kakamega County Referral Hospital", county: "Kakamega", address: "Khasakhala Road", facilityLevel: "COUNTY_REFERRAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Dr. Nasra Ali", userEmail: "nasra@kakamegareferral.go.ke" },
  { facilityIdentifier: "FAC-40003", name: "Garissa County Referral Hospital", county: "Garissa", address: "Kismayu Road", facilityLevel: "COUNTY_REFERRAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.PENDING, userName: "Abdi Noor", userEmail: "abdi@garissareferral.go.ke" },

  // ── National Referral Hospitals (Level 5) ──
  { facilityIdentifier: "FAC-50001", name: "Eldoret National Referral Hospital", county: "Uasin Gishu", address: "Uganda Road", facilityLevel: "NATIONAL_REFERRAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Dr. Kiplangat Rono", userEmail: "kiplangat@eldoretnrh.go.ke" },
  { facilityIdentifier: "FAC-50002", name: "Nairobi National Referral Hospital", county: "Nairobi", address: "Ngong Road", facilityLevel: "NATIONAL_REFERRAL", status: HospitalStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Dr. James Mwangi", userEmail: "james@nairobinrh.go.ke" },
  { facilityIdentifier: "FAC-50003", name: "Coast National Referral Hospital", county: "Mombasa", address: "Moi Avenue", facilityLevel: "NATIONAL_REFERRAL", status: HospitalStatus.INACTIVE, verificationStatus: VerificationStatus.VERIFIED, userName: "Dr. Amina Hassan", userEmail: "amina@coastnrh.go.ke" },
]

// ─── Case templates: 1 normal + 1 anomaly per level ──
type ItemDef = { code: string; qty: number; unitKes: number; description: string }
type CaseTemplate = {
  label: "normal" | "anomaly"
  diagnosis: string
  items: ItemDef[]
  status: ClaimStatus
  ai?: { provider: string; model: string; overallAssessment: string; confidence: number; summary: string; findingType: string; findingSeverity: FindingSeverity; findingExplanation: string; scoreImpact: number }
  review?: { officer: "sarah" | "michael"; status: ReviewStatus; outcome?: string; notes?: string }
  alertStatus?: "OPEN" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "RESOLVED"
}

const LEVEL_CASES: Record<string, CaseTemplate[]> = {
  DISPENSARY: [
    {
      label: "normal",
      diagnosis: "Upper respiratory tract infection",
      items: [
        { code: "CONSULTATION", qty: 1, unitKes: 150, description: "General consultation" },
        { code: "PHARMACY", qty: 1, unitKes: 300, description: "Cold and flu medication" },
      ],
      status: ClaimStatus.CLEARED,
    },
    {
      label: "anomaly",
      diagnosis: "Suspected wrist fracture - referred for imaging",
      items: [
        { code: "CONSULTATION", qty: 1, unitKes: 150, description: "General consultation" },
        { code: "X_RAY", qty: 1, unitKes: 1500, description: "Wrist X-ray" },
        { code: "PHARMACY", qty: 1, unitKes: 500, description: "Pain medication" },
      ],
      status: ClaimStatus.FLAGGED,
      alertStatus: "OPEN",
    },
  ],
  HEALTH_CENTER: [
    {
      label: "normal",
      diagnosis: "Routine antenatal visit",
      items: [
        { code: "ANC", qty: 1, unitKes: 500, description: "Antenatal check-up" },
        { code: "CONSULTATION", qty: 1, unitKes: 200, description: "Consultation" },
      ],
      status: ClaimStatus.CLEARED,
    },
    {
      label: "anomaly",
      diagnosis: "Normal delivery with extended pharmacy supply",
      items: [
        { code: "DELIVERY_NORMAL", qty: 1, unitKes: 20000, description: "Normal delivery care" },
        { code: "PHARMACY", qty: 14, unitKes: 400, description: "Post-delivery medication (bulk)" },
      ],
      status: ClaimStatus.FLAGGED,
      alertStatus: "OPEN",
    },
  ],
  SUB_COUNTY_HOSPITAL: [
    {
      label: "normal",
      diagnosis: "Malaria - uncomplicated",
      items: [
        { code: "CONSULTATION", qty: 1, unitKes: 500, description: "Consultation" },
        { code: "MALARIA_TEST", qty: 1, unitKes: 500, description: "Malaria rapid test" },
        { code: "PHARMACY", qty: 1, unitKes: 800, description: "ACT medication" },
      ],
      status: ClaimStatus.CLEARED,
    },
    {
      label: "anomaly",
      diagnosis: "Head injury - CT requested",
      items: [
        { code: "CONSULTATION", qty: 1, unitKes: 500, description: "Emergency consultation" },
        { code: "CT_SCAN", qty: 1, unitKes: 8000, description: "Head CT scan" },
      ],
      status: ClaimStatus.FLAGGED,
      ai: {
        provider: "groq", model: "llama-3.1-70b-versatile", overallAssessment: "HIGH_RISK", confidence: 0.82,
        summary: "CT scan billed by a facility with no accredited CT capability",
        findingType: "SERVICE_RELEVANCE", findingSeverity: FindingSeverity.HIGH,
        findingExplanation: "Facility verification shows no CT scan accreditation at this level", scoreImpact: 15,
      },
      alertStatus: "OPEN",
    },
  ],
  COUNTY_REFERRAL: [
    {
      label: "normal",
      diagnosis: "Type 2 diabetes - routine workup",
      items: [
        { code: "SPECIALIST_CONSULT", qty: 1, unitKes: 1000, description: "Endocrinology consultation" },
        { code: "BLOOD_CHEM", qty: 1, unitKes: 1500, description: "Metabolic panel" },
        { code: "PHARMACY", qty: 1, unitKes: 2000, description: "Diabetes medication" },
      ],
      status: ClaimStatus.CLEARED,
    },
    {
      label: "anomaly",
      diagnosis: "Complex orthopedic surgery with prolonged ICU stay",
      items: [
        { code: "ORTHO_SURGERY", qty: 1, unitKes: 450000, description: "Hip reconstruction" },
        { code: "ICU", qty: 12, unitKes: 15000, description: "ICU admission (per day)" },
        { code: "SURGERY_MAJOR", qty: 1, unitKes: 200000, description: "Follow-up surgical intervention" },
      ],
      status: ClaimStatus.FLAGGED,
      ai: {
        provider: "groq", model: "llama-3.1-70b-versatile", overallAssessment: "HIGH_RISK", confidence: 0.83,
        summary: "Extended ICU stay and combined surgical billing exceed typical case cost",
        findingType: "AMOUNT_ANOMALY", findingSeverity: FindingSeverity.HIGH,
        findingExplanation: "Combined surgery and 12-day ICU stay is well above the regional case average", scoreImpact: 18,
      },
      review: { officer: "sarah", status: ReviewStatus.PENDING },
      alertStatus: "OPEN",
    },
  ],
  NATIONAL_REFERRAL: [
    {
      label: "normal",
      diagnosis: "Renal failure - dialysis sessions",
      items: [
        { code: "DIALYSIS", qty: 8, unitKes: 10000, description: "Dialysis sessions" },
        { code: "BLOOD_CHEM", qty: 1, unitKes: 1500, description: "Renal panel" },
        { code: "CONSULTATION", qty: 1, unitKes: 2000, description: "Nephrology consult" },
      ],
      status: ClaimStatus.CLEARED,
    },
    {
      label: "anomaly",
      diagnosis: "Multi-organ trauma - emergency major surgery",
      items: [
        { code: "SURGERY_MAJOR", qty: 2, unitKes: 400000, description: "Emergency surgical repair" },
        { code: "ICU", qty: 20, unitKes: 20000, description: "ICU admission (per day)" },
        { code: "AMBULANCE", qty: 1, unitKes: 5000, description: "Emergency transport" },
      ],
      status: ClaimStatus.FLAGGED,
      ai: {
        provider: "openrouter", model: "anthropic/claude-3-haiku", overallAssessment: "HIGH_RISK", confidence: 0.91,
        summary: "Very high combined billing with an extended ICU stay warrants manual review",
        findingType: "AMOUNT_ANOMALY", findingSeverity: FindingSeverity.CRITICAL,
        findingExplanation: "Total claim exceeds KES 1M with a 20-day ICU stay", scoreImpact: 20,
      },
      review: { officer: "michael", status: ReviewStatus.IN_PROGRESS },
      alertStatus: "OPEN",
    },
  ],
}

// ─── Draft claim (Nairobi National Referral) ─────────
const DRAFT_CLAIM = {
  hospitalFacilityIdentifier: "FAC-50002",
  patientRef: "PAT-SYN-999",
  diagnosis: "Pending diagnosis",
  items: [{ code: "CONSULTATION", qty: 1, unitKes: 2000, description: "Consultation (draft)" }],
}

// ─── The two "moving" patients ────────────────────────
// Patient A: pure cross-facility duplicate — same service, two hospitals, one day apart
const PATIENT_A_REF = "PAT-SYN-201"
const PATIENT_A_CLAIMS: { facilityIdentifier: string; diagnosis: string; items: ItemDef[]; date: string; status: ClaimStatus }[] = [
  {
    facilityIdentifier: "FAC-40001", // Nakuru County Referral
    diagnosis: "Chronic headaches - recurring CT requests",
    items: [
      { code: "SPECIALIST_CONSULT", qty: 1, unitKes: 1000, description: "Neurology consultation" },
      { code: "CT_SCAN", qty: 1, unitKes: 8000, description: "Head CT scan" },
    ],
    date: "2026-08-11T09:00:00Z",
    status: ClaimStatus.SUBMITTED,
  },
  {
    facilityIdentifier: "FAC-50001", // Eldoret National Referral
    diagnosis: "Chronic headaches - recurring CT requests",
    items: [
      { code: "CT_SCAN", qty: 1, unitKes: 10000, description: "Head CT scan" },
      { code: "PHARMACY", qty: 1, unitKes: 1500, description: "Pain management medication" },
    ],
    date: "2026-08-12T14:00:00Z",
    status: ClaimStatus.SUBMITTED,
  },
]

// Patient B: dispensary bills a service outside its scope, then a legitimate
// referral claim at a Sub-County Hospital overlaps on the same service code
const PATIENT_B_REF = "PAT-SYN-202"
const PATIENT_B_CLAIMS: { facilityIdentifier: string; diagnosis: string; items: ItemDef[]; date: string; status: ClaimStatus }[] = [
  {
    facilityIdentifier: "FAC-10001", // Kibera Community Dispensary
    diagnosis: "Suspected forearm fracture",
    items: [
      { code: "CONSULTATION", qty: 1, unitKes: 150, description: "General consultation" },
      { code: "X_RAY", qty: 1, unitKes: 1500, description: "Forearm X-ray (outside facility scope)" },
      { code: "PHARMACY", qty: 1, unitKes: 500, description: "Pain medication" },
    ],
    date: "2026-08-13T08:00:00Z",
    status: ClaimStatus.FLAGGED,
  },
  {
    facilityIdentifier: "FAC-30001", // Kiambu Sub-County Hospital
    diagnosis: "Confirmed forearm fracture - referred from dispensary",
    items: [
      { code: "X_RAY", qty: 1, unitKes: 1500, description: "Forearm X-ray" },
      { code: "SURGERY_MINOR", qty: 1, unitKes: 8000, description: "Fracture reduction and casting" },
    ],
    date: "2026-08-15T10:00:00Z",
    status: ClaimStatus.UNDER_REVIEW,
  },
]

async function main() {
  console.log("Seeding database...")

  await prisma.alert.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.reviewAction.deleteMany()
  await prisma.review.deleteMany()
  await prisma.riskContributor.deleteMany()
  await prisma.riskScore.deleteMany()
  await prisma.aiFinding.deleteMany()
  await prisma.aiAnalysis.deleteMany()
  await prisma.finding.deleteMany()
  await prisma.claimRuleEvaluation.deleteMany()
  await prisma.claimItem.deleteMany()
  await prisma.patientServiceHistory.deleteMany()
  await prisma.encounter.deleteMany()
  await prisma.patient.deleteMany()
  await prisma.claim.deleteMany()
  await prisma.serviceCapacity.deleteMany()
  await prisma.serviceTariff.deleteMany()
  await prisma.billingPolicy.deleteMany()
  await prisma.hospitalServiceCapability.deleteMany()
  await prisma.facilityLevelCapability.deleteMany()
  await prisma.serviceStaff.deleteMany()
  await prisma.serviceEquipment.deleteMany()
  await prisma.serviceRequirement.deleteMany()
  await prisma.hospitalOperatingHours.deleteMany()
  await prisma.hospitalStaff.deleteMany()
  await prisma.equipmentMaintenance.deleteMany()
  await prisma.hospitalEquipment.deleteMany()
  await prisma.hospitalService.deleteMany()
  await prisma.complianceRule.deleteMany()
  await prisma.service.deleteMany()
  await prisma.user.deleteMany()
  await prisma.hospital.deleteMany()
  await prisma.facilityLevel.deleteMany()
  await prisma.equipmentType.deleteMany()
  await prisma.staffType.deleteMany()

  // ─── Static lookups ──────────────────────────────────
  const facilityLevels = await Promise.all(FACILITY_LEVEL_DEFS.map((fl) => prisma.facilityLevel.create({ data: fl })))
  const facilityLevelMap = Object.fromEntries(facilityLevels.map((fl) => [fl.code, fl]))

  const equipmentTypes = await Promise.all(EQUIPMENT_TYPE_DEFS.map((et) => prisma.equipmentType.create({ data: et })))
  const equipmentTypeMap = Object.fromEntries(equipmentTypes.map((et) => [et.code, et]))

  const staffTypes = await Promise.all(STAFF_TYPE_DEFS.map((st) => prisma.staffType.create({ data: st })))
  const staffTypeMap = Object.fromEntries(staffTypes.map((st) => [st.code, st]))

  const services = await Promise.all(
    SERVICE_DEFS.map((s) =>
      prisma.service.create({
        data: {
          code: s.code, name: s.name, description: s.description, category: s.category,
          serviceType: s.serviceType as any, isInpatient: s.isInpatient ?? false, isEmergency: s.isEmergency ?? false,
        },
      })
    )
  )
  const serviceMap = Object.fromEntries(services.map((s) => [s.code, s]))

  const rules = await Promise.all(RULE_DEFS.map((r) => prisma.complianceRule.create({ data: r })))
  const ruleMap = Object.fromEntries(rules.map((r) => [r.code, r])) as Record<string, RuleWithId>

  await Promise.all(
    SERVICE_REQUIREMENT_DEFS.map((sr) =>
      prisma.serviceRequirement.create({
        data: { serviceId: serviceMap[sr.serviceCode].id, requirementType: sr.requirementType, requirementCode: sr.requirementCode, isRequired: sr.isRequired, notes: sr.notes },
      })
    )
  )

  await Promise.all(
    [
      { serviceCode: "MRI", equipmentCode: "MRI_SCANNER" },
      { serviceCode: "CT_SCAN", equipmentCode: "CT_SCANNER" },
      { serviceCode: "X_RAY", equipmentCode: "X_RAY_MACHINE" },
      { serviceCode: "ULTRASOUND", equipmentCode: "ULTRASOUND" },
      { serviceCode: "DIALYSIS", equipmentCode: "DIALYSIS_MACHINE" },
      { serviceCode: "ICU", equipmentCode: "VENTILATOR" },
      { serviceCode: "ICU", equipmentCode: "DEFIBRILLATOR" },
      { serviceCode: "EMERGENCY", equipmentCode: "DEFIBRILLATOR" },
    ].map((se) => prisma.serviceEquipment.create({ data: { serviceId: serviceMap[se.serviceCode].id, equipmentTypeId: equipmentTypeMap[se.equipmentCode].id, isRequired: true, minQuantity: 1 } }))
  )

  await Promise.all(
    [
      { serviceCode: "SURGERY_MAJOR", staffCode: "SURGEON" }, { serviceCode: "SURGERY_MAJOR", staffCode: "ANAESTHETIST" },
      { serviceCode: "SURGERY_MINOR", staffCode: "SURGEON" }, { serviceCode: "ORTHO_SURGERY", staffCode: "SURGEON" },
      { serviceCode: "ORTHO_SURGERY", staffCode: "ANAESTHETIST" }, { serviceCode: "DELIVERY_CS", staffCode: "SURGEON" },
      { serviceCode: "DELIVERY_CS", staffCode: "ANAESTHETIST" }, { serviceCode: "CHEMOTHERAPY", staffCode: "SPECIALIST" },
      { serviceCode: "MALARIA_TEST", staffCode: "LAB_TECHNICIAN" }, { serviceCode: "CBC", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "URINALYSIS", staffCode: "LAB_TECHNICIAN" }, { serviceCode: "BLOOD_CHEM", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "HIV_TEST", staffCode: "LAB_TECHNICIAN" }, { serviceCode: "TB_SCREEN", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "BLOOD_GROUP", staffCode: "LAB_TECHNICIAN" }, { serviceCode: "X_RAY", staffCode: "RADIOGRAPHER" },
      { serviceCode: "CT_SCAN", staffCode: "RADIOGRAPHER" }, { serviceCode: "MRI", staffCode: "RADIOGRAPHER" },
      { serviceCode: "PHARMACY", staffCode: "PHARMACIST" }, { serviceCode: "CONSULTATION", staffCode: "PHYSICIAN" },
      { serviceCode: "SPECIALIST_CONSULT", staffCode: "SPECIALIST" }, { serviceCode: "ICU", staffCode: "NURSE" },
    ].map((ss) => prisma.serviceStaff.create({ data: { serviceId: serviceMap[ss.serviceCode].id, staffTypeId: staffTypeMap[ss.staffCode].id, isRequired: true, minQuantity: 1 } }))
  )

  await Promise.all(
    FACILITY_LEVEL_CAPABILITY_DEFS.map((flc) =>
      prisma.facilityLevelCapability.create({
        data: { facilityLevelId: facilityLevelMap[flc.facilityLevelCode].id, serviceId: serviceMap[flc.serviceCode].id, isExpected: flc.isExpected, isAllowed: flc.isAllowed, requiresAccreditation: flc.requiresAccreditation },
      })
    )
  )

  await Promise.all(
    SERVICE_TARIFF_DEFS.map((st) =>
      prisma.serviceTariff.create({
        data: { serviceId: serviceMap[st.serviceCode].id, facilityLevelId: facilityLevelMap[st.facilityLevelCode].id, unitAmountCents: kes(st.unitAmountKes), minAmountCents: st.minAmountKes ? kes(st.minAmountKes) : undefined, maxAmountCents: st.maxAmountKes ? kes(st.maxAmountKes) : undefined },
      })
    )
  )

  await Promise.all(
    BILLING_POLICY_DEFS.map((bp) =>
      prisma.billingPolicy.create({
        data: { facilityLevelId: facilityLevelMap[bp.facilityLevelCode].id, serviceId: bp.serviceCode ? serviceMap[bp.serviceCode].id : undefined, maxPerEncounter: bp.maxPerEncounter, maxPerService: bp.maxPerService, maxQtyPerService: bp.maxQtyPerService, maxDailyAmount: bp.maxDailyAmount },
      })
    )
  )

  // ─── SHA staff ────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password", 10)
  const shaOfficer1 = await prisma.user.create({ data: { name: "Dr. Sarah Wanjiku", email: "sarah@sha.go.ke", passwordHash, role: UserRole.SHA_OFFICER } })
  const shaOfficer2 = await prisma.user.create({ data: { name: "Michael Ochieng", email: "michael@sha.go.ke", passwordHash, role: UserRole.SHA_OFFICER } })
  const admin = await prisma.user.create({ data: { name: "System Admin", email: "admin@sha.go.ke", passwordHash, role: UserRole.ADMIN } })
  const officers = { sarah: shaOfficer1, michael: shaOfficer2 }

  await prisma.auditLog.create({ data: { userId: admin.id, action: "SYSTEM_SEEDED", entityType: "System", entityId: "seed" } })

  // ─── Counters ─────────────────────────────────────────
  let claimCount = 0, itemCount = 0, ruleEvalCount = 0, findingCount = 0, aiAnalysisCount = 0, aiFindingCount = 0
  let riskScoreCount = 0, reviewCount = 0, alertCount = 0, auditLogCount = 1, patientCount = 0, encounterCount = 0
  let serviceHistoryCount = 0, equipmentCount = 0, staffCount = 0, operatingHoursCount = 0, hospitalCapabilityCount = 0
  let serviceCapacityCount = 0

  // Track created hospitals for cross-facility claims
  const hospitalRecords: Record<string, { id: string; name: string; userId: string; facilityLevelCode: string; verificationStatus: VerificationStatus; services: string[] }> = {}
  const patientRecords: Record<string, { id: string }> = {}

  // Ledger for real duplicate / cross-facility detection
  type LedgerEntry = { serviceCode: string; hospitalId: string; hospitalName: string; claimDate: Date; claimReference: string }
  const patientLedger: Record<string, LedgerEntry[]> = {}

  async function getOrCreatePatient(ref: string) {
    if (patientRecords[ref]) return patientRecords[ref]
    const patient = await prisma.patient.create({ data: { externalReference: ref } })
    patientCount++
    patientRecords[ref] = { id: patient.id }
    return patientRecords[ref]
  }

  // ─── Create hospitals with level-templated equipment/staff/hours/capacity ─
  for (const h of HOSPITAL_DEFS) {
    const services_ = servicesForLevel(h.facilityLevel)
    const hospital = await prisma.hospital.create({
      data: {
        facilityIdentifier: h.facilityIdentifier, name: h.name, type: h.facilityLevel,
        status: h.status, verificationStatus: h.verificationStatus,
        location: { county: h.county, address: h.address },
        facilityLevelId: facilityLevelMap[h.facilityLevel].id,
      },
    })

    for (const code of services_) {
      await prisma.hospitalService.create({ data: { hospitalId: hospital.id, serviceId: serviceMap[code].id } })
    }

    if (h.verificationStatus === VerificationStatus.VERIFIED) {
      for (const code of services_) {
        const levelCapability = await prisma.facilityLevelCapability.findFirst({ where: { facilityLevelId: facilityLevelMap[h.facilityLevel].id, serviceId: serviceMap[code].id } })
        await prisma.hospitalServiceCapability.create({
          data: { hospitalId: hospital.id, serviceId: serviceMap[code].id, isOffered: true, isAccredited: levelCapability?.requiresAccreditation ?? false, isActive: true },
        })
        hospitalCapabilityCount++
      }
    }

    for (const eq of LEVEL_EQUIPMENT_TEMPLATE[h.facilityLevel] ?? []) {
      await prisma.hospitalEquipment.create({
        data: { hospitalId: hospital.id, equipmentTypeId: equipmentTypeMap[eq.code].id, quantity: eq.qty, operationalQuantity: eq.qty, status: eq.status ?? EquipmentStatus.OPERATIONAL, notes: eq.notes },
      })
      equipmentCount++
    }

    for (const st of LEVEL_STAFF_TEMPLATE[h.facilityLevel] ?? []) {
      await prisma.hospitalStaff.create({ data: { hospitalId: hospital.id, staffTypeId: staffTypeMap[st.code].id, quantity: st.qty, activeQuantity: st.qty } })
      staffCount++
    }

    for (const hours of LEVEL_HOURS_TEMPLATE[h.facilityLevel] ?? WEEKDAY_ONLY) {
      await prisma.hospitalOperatingHours.create({
        data: { hospitalId: hospital.id, dayOfWeek: hours.dayOfWeek, isOpen: hours.isOpen, is24Hour: hours.is24Hour, openTime: hours.openTime, closeTime: hours.closeTime, hasEmergency: hours.hasEmergency },
      })
      operatingHoursCount++
    }

    for (const sc of LEVEL_CAPACITY_TEMPLATE[h.facilityLevel] ?? []) {
      await prisma.serviceCapacity.create({
        data: { hospitalId: hospital.id, serviceId: serviceMap[sc.serviceCode].id, theoreticalDailyCapacity: sc.theoreticalDailyCapacity, operationalDailyCapacity: sc.operationalDailyCapacity, weeklyCapacity: sc.weeklyCapacity, monthlyCapacity: sc.monthlyCapacity, averageProcedureDurationMinutes: sc.averageProcedureDurationMinutes, capacityBasis: sc.capacityBasis as any },
      })
      serviceCapacityCount++
    }

    const hospitalUser = await prisma.user.create({ data: { name: h.userName, email: h.userEmail, passwordHash, role: UserRole.HOSPITAL_USER, hospitalId: hospital.id } })

    hospitalRecords[h.facilityIdentifier] = {
      id: hospital.id, name: h.name, userId: hospitalUser.id, facilityLevelCode: h.facilityLevel,
      verificationStatus: h.verificationStatus, services: services_,
    }
  }

  // ─── Core claim-creation pipeline (shared by level cases + moving patients) ─
  async function createCase(params: {
    facilityIdentifier: string
    patientRef: string
    diagnosis: string
    items: ItemDef[]
    submittedAt: string
    status: ClaimStatus
    seqSuffix: string
    ai?: CaseTemplate["ai"]
    review?: CaseTemplate["review"]
    alertStatus?: CaseTemplate["alertStatus"]
    forceAlert?: boolean
  }) {
    const h = hospitalRecords[params.facilityIdentifier]
    const patient = await getOrCreatePatient(params.patientRef)
    const submittedDate = new Date(params.submittedAt)

    const items = params.items.map((it) => ({ ...it, unitAmountCents: kes(it.unitKes), totalAmountCents: kes(it.unitKes) * it.qty }))
    const totalAmountCents = items.reduce((sum, it) => sum + it.totalAmountCents, 0)

    const hasSurgery = items.some((it) => it.code.startsWith("SURGERY") || it.code === "DELIVERY_CS")
    const hasEmergencyService = items.some((it) => it.code === "EMERGENCY" || it.code === "AMBULANCE")
    const hasICU = items.some((it) => it.code === "ICU")
    const hasOtherInpatient = items.some((it) => it.code === "DIALYSIS" || it.code === "CHEMOTHERAPY")
    let encounterType: EncounterType = EncounterType.OUTPATIENT
    if (hasSurgery || hasICU || hasOtherInpatient) encounterType = EncounterType.INPATIENT
    else if (hasEmergencyService) encounterType = EncounterType.EMERGENCY

    const encounter = await prisma.encounter.create({
      data: {
        patientId: patient.id, hospitalId: h.id, encounterDate: submittedDate, encounterType,
        diagnosis: params.diagnosis, status: params.status === ClaimStatus.DRAFT ? "DRAFT" : "ACTIVE",
        admissionDate: hasICU || hasOtherInpatient ? submittedDate : undefined,
      },
    })
    encounterCount++

    const claim = await prisma.claim.create({
      data: {
        reference: `CLM-2026-${params.facilityIdentifier.slice(-5)}-${params.seqSuffix}`,
        hospitalId: h.id, submittedById: h.userId, patientId: patient.id, encounterId: encounter.id,
        patientReference: params.patientRef, diagnosis: params.diagnosis, status: params.status,
        source: ClaimSource.HOSPITAL_PORTAL, totalAmountCents, submittedAt: submittedDate,
      },
    })
    claimCount++

    for (const it of items) {
      await prisma.claimItem.create({ data: { claimId: claim.id, serviceId: serviceMap[it.code].id, description: it.description, quantity: it.qty, unitAmountCents: it.unitAmountCents, totalAmountCents: it.totalAmountCents } })
      itemCount++
    }

    await prisma.auditLog.create({ data: { userId: h.userId, action: "CLAIM_SUBMITTED", entityType: "Claim", entityId: claim.id } })
    auditLogCount++

    // Draft claims skip rule evaluation entirely (mirrors a real in-progress draft)
    if (params.status === ClaimStatus.DRAFT) return

    // ── Real duplicate / cross-facility check against the ledger (checked BEFORE this claim's items are recorded) ──
    let sameHospitalDuplicate = false
    let crossFacilityDuplicate = false
    let crossFacilityMatch: LedgerEntry | undefined
    const ledger = patientLedger[params.patientRef] ?? []
    for (const it of items) {
      const matches = ledger.filter((e) => e.serviceCode === it.code && daysBetween(e.claimDate, submittedDate) <= DUPLICATE_WINDOW_DAYS)
      for (const m of matches) {
        if (m.hospitalId === h.id) sameHospitalDuplicate = true
        else { crossFacilityDuplicate = true; crossFacilityMatch = m }
      }
    }

    for (const it of items) {
      await prisma.patientServiceHistory.create({
        data: { patientId: patient.id, serviceId: serviceMap[it.code].id, encounterId: encounter.id, facilityLevelRank: facilityLevels.find((fl) => fl.id === facilityLevelMap[h.facilityLevelCode].id)!.rank, claimedAmountCents: it.totalAmountCents, quantity: it.qty, claimDate: submittedDate },
      })
      serviceHistoryCount++
      patientLedger[params.patientRef] = [...(patientLedger[params.patientRef] ?? []), { serviceCode: it.code, hospitalId: h.id, hospitalName: h.name, claimDate: submittedDate, claimReference: claim.reference }]
    }

    // ── Rule triggers ──
    const mismatched = items.filter((it) => !h.services.includes(it.code))
    const oversizedQty = items.filter((it) => it.qty > QTY_THRESHOLD)

    const triggers: { rule: RuleWithId; triggered: boolean; explanation: string }[] = [
      { rule: ruleMap["R-001"], triggered: h.verificationStatus !== VerificationStatus.VERIFIED, explanation: `Facility verification status: ${h.verificationStatus}` },
      { rule: ruleMap["R-002"], triggered: mismatched.length > 0, explanation: mismatched.length ? `Claimed service(s) not in facility capabilities: ${mismatched.map((m) => m.code).join(", ")}` : "All claimed services are within facility capabilities" },
      { rule: ruleMap["R-003"], triggered: sameHospitalDuplicate, explanation: sameHospitalDuplicate ? `Same patient billed for a matching service at ${h.name} within ${DUPLICATE_WINDOW_DAYS} days` : "No same-facility duplicate detected" },
      { rule: ruleMap["R-004"], triggered: totalAmountCents > AMOUNT_THRESHOLD_CENTS, explanation: `Claim total is KES ${(totalAmountCents / 100).toLocaleString()} (threshold KES ${(AMOUNT_THRESHOLD_CENTS / 100).toLocaleString()})` },
      { rule: ruleMap["R-005"], triggered: oversizedQty.length > 0, explanation: oversizedQty.length ? `Item quantity exceeds ${QTY_THRESHOLD}: ${oversizedQty.map((m) => `${m.code} x${m.qty}`).join(", ")}` : "All item quantities within normal range" },
      { rule: ruleMap["R-007"], triggered: crossFacilityDuplicate, explanation: crossFacilityDuplicate && crossFacilityMatch ? `Same patient billed for a matching service at ${crossFacilityMatch.hospitalName} (claim ${crossFacilityMatch.claimReference}) within ${DUPLICATE_WINDOW_DAYS} days` : "No cross-facility duplicate detected" },
    ]

    let ruleScore = 0
    for (const t of triggers) {
      await prisma.claimRuleEvaluation.create({ data: { claimId: claim.id, complianceRuleId: t.rule.id, triggered: t.triggered, scoreContribution: t.triggered ? t.rule.scoreContribution : 0, explanation: t.explanation } })
      ruleEvalCount++
      if (t.triggered) {
        ruleScore += t.rule.scoreContribution
        await prisma.finding.create({
          data: { claimId: claim.id, complianceRuleId: t.rule.id, type: t.rule.name.toUpperCase().replace(/\s+/g, "_"), severity: t.rule.severity, source: FindingSource.RULE, title: t.rule.name, explanation: t.explanation, scoreContribution: t.rule.scoreContribution },
        })
        findingCount++
      }
    }

    // ── AI analysis ──
    let aiScoreImpact = 0
    if (params.ai) {
      const analysis = await prisma.aiAnalysis.create({
        data: { claimId: claim.id, provider: params.ai.provider, model: params.ai.model, status: AiAnalysisStatus.COMPLETED, structuredResponse: { overallAssessment: params.ai.overallAssessment, confidence: params.ai.confidence, summary: params.ai.summary }, confidence: params.ai.confidence, startedAt: submittedDate, completedAt: new Date(submittedDate.getTime() + 60_000) },
      })
      aiAnalysisCount++
      await prisma.aiFinding.create({ data: { aiAnalysisId: analysis.id, claimId: claim.id, type: params.ai.findingType, severity: params.ai.findingSeverity, confidence: params.ai.confidence, explanation: params.ai.findingExplanation } })
      aiFindingCount++
      aiScoreImpact = params.ai.scoreImpact
    }

    // ── Risk score ──
    const totalScore = ruleScore + aiScoreImpact
    const riskScore = await prisma.riskScore.create({ data: { claimId: claim.id, score: totalScore, level: riskLevelFromScore(totalScore) } })
    riskScoreCount++

    const contributors = triggers.filter((t) => t.triggered).map((t) => ({ riskScoreId: riskScore.id, type: "RULE", description: t.rule.name, scoreImpact: t.rule.scoreContribution }))
    if (params.ai) contributors.push({ riskScoreId: riskScore.id, type: "AI", description: params.ai.summary, scoreImpact: aiScoreImpact })
    if (contributors.length) await prisma.riskContributor.createMany({ data: contributors })

    // ── Review ──
    if (params.review) {
      const review = await prisma.review.create({
        data: { claimId: claim.id, reviewerId: officers[params.review.officer].id, status: params.review.status, outcome: params.review.outcome as ReviewOutcome, notes: params.review.notes, startedAt: submittedDate, completedAt: params.review.status === ReviewStatus.COMPLETED ? new Date() : undefined },
      })
      reviewCount++
      await prisma.reviewAction.create({ data: { reviewId: review.id, action: params.review.status === ReviewStatus.COMPLETED ? "OUTCOME_RECORDED" : "REVIEW_STARTED", details: { notes: params.review.notes ?? "Review initiated" } } })
      await prisma.auditLog.create({ data: { userId: officers[params.review.officer].id, action: params.review.status === ReviewStatus.COMPLETED ? "REVIEW_COMPLETED" : "REVIEW_STARTED", entityType: "Review", entityId: review.id } })
      auditLogCount++
    }

    // ── Alert ──
    if (totalScore >= 50 || params.forceAlert || params.alertStatus) {
      const status = params.alertStatus ?? "OPEN"
      const alertType = crossFacilityDuplicate ? "CROSS_FACILITY_ANOMALY" : sameHospitalDuplicate ? "DUPLICATE_CLAIM" : mismatched.length ? "FACILITY_LEVEL_MISMATCH" : params.ai ? "AI_REVIEW_REQUIRED" : "HIGH_RISK_CLAIM"
      await prisma.alert.create({
        data: {
          type: alertType as any, severity: totalScore >= 75 ? "CRITICAL" : "HIGH", status: status as any,
          title: `High risk claim: ${claim.reference}`, description: `Claim ${claim.reference} from ${h.name} has a risk score of ${totalScore}.`,
          claimId: claim.id, hospitalId: h.id, riskScoreId: riskScore.id, source: params.ai ? "AI" : "RULE",
          resolvedAt: status === "RESOLVED" ? new Date() : undefined,
          resolvedById: status === "RESOLVED" ? officers[params.review?.officer ?? "sarah"].id : undefined,
          metadata: { riskScore: totalScore, riskLevel: riskLevelFromScore(totalScore) },
        },
      })
      alertCount++
      await prisma.auditLog.create({ data: { userId: shaOfficer1.id, action: "CLAIM_FLAGGED", entityType: "Claim", entityId: claim.id } })
      auditLogCount++
    }
  }

  // ─── Two realistic cases per hospital ─────────────────
  let hospIdx = 0
  for (const h of HOSPITAL_DEFS) {
    hospIdx++
    const cases = LEVEL_CASES[h.facilityLevel]
    for (const [i, c] of cases.entries()) {
      const day = 1 + hospIdx // spread submission dates across August 2026
      await createCase({
        facilityIdentifier: h.facilityIdentifier,
        patientRef: `PAT-SYN-${h.facilityIdentifier.slice(-4)}${i + 1}`,
        diagnosis: c.diagnosis,
        items: c.items,
        submittedAt: `2026-08-${String(day).padStart(2, "0")}T0${7 + i}:00:00Z`,
        status: c.status,
        seqSuffix: String(i + 1).padStart(2, "0"),
        ai: c.ai,
        review: c.review,
        alertStatus: c.alertStatus,
      })
    }
  }

  // ─── Patient A — cross-facility duplicate ─────────────
  for (const [i, c] of PATIENT_A_CLAIMS.entries()) {
    await createCase({
      facilityIdentifier: c.facilityIdentifier,
      patientRef: PATIENT_A_REF,
      diagnosis: c.diagnosis,
      items: c.items,
      submittedAt: c.date,
      status: c.status,
      seqSuffix: `CF${i + 1}`,
      forceAlert: true,
      alertStatus: "OPEN",
    })
  }

  // ─── Patient B — dispensary scope breach + legitimate referral overlap ─
  for (const [i, c] of PATIENT_B_CLAIMS.entries()) {
    await createCase({
      facilityIdentifier: c.facilityIdentifier,
      patientRef: PATIENT_B_REF,
      diagnosis: c.diagnosis,
      items: c.items,
      submittedAt: c.date,
      status: c.status,
      seqSuffix: `RF${i + 1}`,
      forceAlert: true,
      alertStatus: i === 1 ? "UNDER_REVIEW" : "OPEN",
      review: i === 1 ? { officer: "sarah", status: ReviewStatus.IN_PROGRESS, notes: "Verifying whether this is a legitimate referral follow-up or duplicate billing with the dispensary claim." } : undefined,
    })
  }

  // ─── Draft claim ──────────────────────────────────────
  const draft = DRAFT_CLAIM
  await createCase({
    facilityIdentifier: draft.hospitalFacilityIdentifier,
    patientRef: draft.patientRef,
    diagnosis: draft.diagnosis,
    items: draft.items,
    submittedAt: "2026-08-16T09:00:00Z",
    status: ClaimStatus.DRAFT,
    seqSuffix: "DRAFT",
  })

  console.log("Seed completed successfully!")
  console.log(`  ${facilityLevels.length} facility levels`)
  console.log(`  ${equipmentTypes.length} equipment types`)
  console.log(`  ${staffTypes.length} staff types`)
  console.log(`  ${services.length} services`)
  console.log(`  ${rules.length} compliance rules`)
  console.log(`  ${HOSPITAL_DEFS.length} hospitals (3 per facility level)`)
  console.log(`  ${claimCount} claims`)
  console.log(`  ${itemCount} claim items`)
  console.log(`  ${ruleEvalCount} rule evaluations`)
  console.log(`  ${findingCount} deterministic findings`)
  console.log(`  ${aiAnalysisCount} AI analyses / ${aiFindingCount} AI findings`)
  console.log(`  ${riskScoreCount} risk scores`)
  console.log(`  ${reviewCount} reviews`)
  console.log(`  ${alertCount} alerts`)
  console.log(`  ${patientCount} patients (including 2 cross-facility "moving" patients)`)
  console.log(`  ${encounterCount} encounters`)
  console.log(`  ${serviceHistoryCount} patient service histories`)
  console.log(`  ${equipmentCount} hospital equipment entries`)
  console.log(`  ${staffCount} hospital staff entries`)
  console.log(`  ${operatingHoursCount} operating hours entries`)
  console.log(`  ${hospitalCapabilityCount} hospital service capabilities`)
  console.log(`  ${serviceCapacityCount} service capacity entries`)
  console.log(`  ${auditLogCount} audit log entries`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })