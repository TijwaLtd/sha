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
  BillingStatus,
  ServiceType,
  CapacityBasis,
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

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return RiskLevel.CRITICAL
  if (score >= 50) return RiskLevel.HIGH
  if (score >= 25) return RiskLevel.MODERATE
  return RiskLevel.LOW
}

// ─── Service catalogue ───────────────────────────────
type ServiceDef = {
  code: string
  name: string
  description: string
  category: string
  serviceType: ServiceType
  isInpatient?: boolean
  isEmergency?: boolean
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    code: "CONSULTATION",
    name: "General Consultation",
    description: "Outpatient consultation with physician",
    category: "OUTPATIENT",
    serviceType: ServiceType.DIAGNOSTIC,
  },
  {
    code: "SPECIALIST_CONSULT",
    name: "Specialist Consultation",
    description: "Consultation with a specialist physician",
    category: "OUTPATIENT",
    serviceType: ServiceType.DIAGNOSTIC,
  },
  {
    code: "MALARIA_TEST",
    name: "Malaria Test",
    description: "Rapid diagnostic test for malaria",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "CBC",
    name: "Complete Blood Count",
    description: "Full blood count laboratory test",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "URINALYSIS",
    name: "Urinalysis",
    description: "Urine laboratory analysis",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "BLOOD_CHEM",
    name: "Blood Chemistry Panel",
    description: "Metabolic/electrolyte blood panel",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "HIV_TEST",
    name: "HIV Testing & Counselling",
    description: "HIV rapid test with counselling",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "TB_SCREEN",
    name: "TB Screening (GeneXpert)",
    description: "Molecular TB screening test",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "BLOOD_GROUP",
    name: "Blood Grouping & Crossmatch",
    description: "Blood typing and crossmatch",
    category: "LABORATORY",
    serviceType: ServiceType.LABORATORY,
  },
  {
    code: "X_RAY",
    name: "X-Ray",
    description: "Radiographic imaging",
    category: "RADIOLOGY",
    serviceType: ServiceType.RADIOLOGY,
  },
  {
    code: "ULTRASOUND",
    name: "Ultrasound",
    description: "Diagnostic ultrasound imaging",
    category: "RADIOLOGY",
    serviceType: ServiceType.RADIOLOGY,
  },
  {
    code: "CT_SCAN",
    name: "CT Scan",
    description: "Computed tomography imaging",
    category: "RADIOLOGY",
    serviceType: ServiceType.RADIOLOGY,
  },
  {
    code: "MRI",
    name: "MRI Scan",
    description: "Magnetic Resonance Imaging",
    category: "RADIOLOGY",
    serviceType: ServiceType.RADIOLOGY,
  },
  {
    code: "SURGERY_MINOR",
    name: "Minor Surgery",
    description: "Minor surgical procedure",
    category: "SURGERY",
    serviceType: ServiceType.SURGICAL,
  },
  {
    code: "SURGERY_MAJOR",
    name: "Major Surgery",
    description: "Major surgical procedure",
    category: "SURGERY",
    serviceType: ServiceType.SURGICAL,
    isInpatient: true,
  },
  {
    code: "ORTHO_SURGERY",
    name: "Orthopedic Surgery",
    description: "Bone/joint surgical procedure",
    category: "SURGERY",
    serviceType: ServiceType.SURGICAL,
    isInpatient: true,
  },
  {
    code: "ANC",
    name: "Antenatal Care",
    description: "Antenatal check-up and monitoring",
    category: "MATERNITY",
    serviceType: ServiceType.PREVENTIVE,
  },
  {
    code: "DELIVERY_NORMAL",
    name: "Normal Delivery",
    description: "Vaginal delivery care",
    category: "MATERNITY",
    serviceType: ServiceType.THERAPEUTIC,
    isInpatient: true,
  },
  {
    code: "DELIVERY_CS",
    name: "Caesarean Section",
    description: "Surgical delivery",
    category: "MATERNITY",
    serviceType: ServiceType.SURGICAL,
    isInpatient: true,
  },
  {
    code: "POSTNATAL",
    name: "Postnatal Care",
    description: "Post-delivery follow-up care",
    category: "MATERNITY",
    serviceType: ServiceType.THERAPEUTIC,
  },
  {
    code: "DENTAL",
    name: "Dental Services",
    description: "Dental examination and treatment",
    category: "DENTAL",
    serviceType: ServiceType.DENTAL,
  },
  {
    code: "PHARMACY",
    name: "Pharmacy",
    description: "Dispensing of medication",
    category: "PHARMACY",
    serviceType: ServiceType.PHARMACY,
  },
  {
    code: "EMERGENCY",
    name: "Emergency Services",
    description: "Emergency medical care",
    category: "EMERGENCY",
    serviceType: ServiceType.THERAPEUTIC,
    isEmergency: true,
  },
  {
    code: "AMBULANCE",
    name: "Ambulance Services",
    description: "Emergency patient transport",
    category: "EMERGENCY",
    serviceType: ServiceType.THERAPEUTIC,
    isEmergency: true,
  },
  {
    code: "ICU",
    name: "Intensive Care Unit",
    description: "Critical care admission, per day",
    category: "CRITICAL_CARE",
    serviceType: ServiceType.THERAPEUTIC,
    isInpatient: true,
  },
  {
    code: "DIALYSIS",
    name: "Renal Dialysis",
    description: "Dialysis session",
    category: "CRITICAL_CARE",
    serviceType: ServiceType.THERAPEUTIC,
  },
  {
    code: "CHEMOTHERAPY",
    name: "Chemotherapy",
    description: "Chemotherapy session",
    category: "ONCOLOGY",
    serviceType: ServiceType.THERAPEUTIC,
  },
  {
    code: "PHYSIOTHERAPY",
    name: "Physiotherapy",
    description: "Physiotherapy session",
    category: "PHYSIOTHERAPY",
    serviceType: ServiceType.REHABILITATION,
  },
  {
    code: "MENTAL_HEALTH",
    name: "Mental Health Services",
    description: "Mental health outpatient session",
    category: "MENTAL_HEALTH",
    serviceType: ServiceType.MENTAL_HEALTH,
  },
  {
    code: "FAMILY_PLANNING",
    name: "Family Planning",
    description: "Family planning services",
    category: "PREVENTIVE",
    serviceType: ServiceType.PREVENTIVE,
  },
  {
    code: "IMMUNIZATION",
    name: "Immunization",
    description: "Vaccination services",
    category: "PREVENTIVE",
    serviceType: ServiceType.PREVENTIVE,
  },
  {
    code: "OPTICAL",
    name: "Eye Clinic",
    description: "Optical/eye clinic services",
    category: "OPTICAL",
    serviceType: ServiceType.OPTICAL,
  },
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
  {
    code: "R-001",
    name: "Facility Not Verified",
    description: "Claim submitted by unverified facility",
    category: "FACILITY",
    severity: FindingSeverity.HIGH,
    scoreContribution: 50,
  },
  {
    code: "R-002",
    name: "Facility Service Mismatch",
    description: "Claimed service not in facility capabilities",
    category: "FACILITY",
    severity: FindingSeverity.HIGH,
    scoreContribution: 50,
  },
  {
    code: "R-003",
    name: "Duplicate Claim",
    description: "Similar claim already submitted",
    category: "CLAIM",
    severity: FindingSeverity.CRITICAL,
    scoreContribution: 30,
  },
  {
    code: "R-004",
    name: "Unusual Claim Amount",
    description: "Claim amount above KES 750,000",
    category: "AMOUNT",
    severity: FindingSeverity.MEDIUM,
    scoreContribution: 15,
  },
  {
    code: "R-005",
    name: "Unusual Quantity",
    description: "A line item quantity exceeds 10",
    category: "AMOUNT",
    severity: FindingSeverity.MEDIUM,
    scoreContribution: 10,
  },
  {
    code: "R-006",
    name: "Diagnosis Mismatch",
    description: "Service does not match claimed diagnosis",
    category: "CLINICAL",
    severity: FindingSeverity.HIGH,
    scoreContribution: 20,
  },
]

// ─── Hospital + claim configuration ──────────────────
type ItemDef = {
  code: string
  qty: number
  unitKes: number
  description: string
}

type AiDef = {
  provider: string
  model: string
  overallAssessment: string
  confidence: number
  summary: string
  findingType: string
  findingSeverity: FindingSeverity
  findingExplanation: string
  scoreImpact: number
}

type ReviewDef = {
  officer: "sarah" | "michael"
  status: ReviewStatus
  outcome?: string
  notes?: string
}

type ClaimDef = {
  patientRef: string
  diagnosis: string
  status: ClaimStatus
  items: ItemDef[]
  submittedAt: string
  ai?: AiDef
  review?: ReviewDef
  alertStatus?: "OPEN" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "RESOLVED"
}

type HospitalDef = {
  facilityIdentifier: string
  name: string
  type: string
  county: string
  address: string
  status: HospitalStatus
  verificationStatus: VerificationStatus
  services: string[]
  userName: string
  userEmail: string
  claims: ClaimDef[]
  facilityLevel: string // FacilityLevel code
}

const HOSPITAL_DEFS: HospitalDef[] = [
  {
    facilityIdentifier: "HOSP-101",
    name: "Kibera Community Dispensary",
    type: "DISPENSARY",
    county: "Nairobi",
    address: "Kibera Drive",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.UNVERIFIED,
    services: ["CONSULTATION", "PHARMACY", "IMMUNIZATION", "FAMILY_PLANNING"],
    userName: "Faith Nyambura",
    userEmail: "faith@kiberadispensary.co.ke",
    facilityLevel: "DISPENSARY",
    claims: [
      {
        patientRef: "PAT-SYN-101",
        diagnosis: "Common cold",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-01T08:00:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 150,
            description: "General consultation",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 300,
            description: "Cold and flu medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-102",
        diagnosis: "Routine infant immunization",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-02T09:00:00Z",
        items: [
          {
            code: "IMMUNIZATION",
            qty: 1,
            unitKes: 200,
            description: "Infant vaccination",
          },
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 150,
            description: "Wellness check",
          },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-102",
    name: "Ongata Rongai Health Centre",
    type: "HEALTH_CENTER",
    county: "Kajiado",
    address: "Magadi Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "PHARMACY",
      "IMMUNIZATION",
      "FAMILY_PLANNING",
      "ANC",
      "DELIVERY_NORMAL",
    ],
    userName: "Josephine Wambui",
    userEmail: "josephine@ongatahealth.co.ke",
    facilityLevel: "HEALTH_CENTER",
    claims: [
      {
        patientRef: "PAT-SYN-103",
        diagnosis: "Routine antenatal visit",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-01T10:00:00Z",
        items: [
          {
            code: "ANC",
            qty: 1,
            unitKes: 500,
            description: "Antenatal check-up",
          },
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 150,
            description: "Consultation",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-104",
        diagnosis: "Normal delivery",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-03T06:00:00Z",
        items: [
          {
            code: "DELIVERY_NORMAL",
            qty: 1,
            unitKes: 30000,
            description: "Normal delivery care",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 5000,
            description: "Post-delivery medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-105",
        diagnosis: "Suspected wrist fracture",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-05T11:00:00Z",
        items: [
          { code: "X_RAY", qty: 1, unitKes: 1500, description: "Wrist X-ray" },
        ],
      },
      // ── Contextual rule: R-010 Patient service frequency ──
      {
        patientRef: "PAT-SYN-123",
        diagnosis: "Recurrent malaria episodes - frequent testing",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-11T10:00:00Z",
        items: [
          { code: "MALARIA_TEST", qty: 8, unitKes: 300, description: "Repeated malaria rapid tests" },
          { code: "CONSULTATION", qty: 8, unitKes: 200, description: "Follow-up consultations" },
          { code: "PHARMACY", qty: 8, unitKes: 500, description: "Antimalarial medication" },
        ],
      },
      // ── Contextual rule: R-016 Daily billing limit exceeded ──
      {
        patientRef: "PAT-SYN-129",
        diagnosis: "Busy maternity day - multiple deliveries",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-12T06:00:00Z",
        items: [
          { code: "DELIVERY_NORMAL", qty: 3, unitKes: 20000, description: "Normal deliveries" },
          { code: "PHARMACY", qty: 10, unitKes: 1500, description: "Post-delivery medication" },
          { code: "CONSULTATION", qty: 5, unitKes: 200, description: "Prenatal consultations" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-103",
    name: "Kiambu Sub-County Hospital",
    type: "SUB_COUNTY_HOSPITAL",
    county: "Kiambu",
    address: "Thika Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "X_RAY",
      "ULTRASOUND",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "SURGERY_MINOR",
      "PHARMACY",
      "EMERGENCY",
      "DENTAL",
    ],
    userName: "Daniel Kamau",
    userEmail: "daniel@kiambuscsh.go.ke",
    facilityLevel: "SUB_COUNTY_HOSPITAL",
    claims: [
      {
        patientRef: "PAT-SYN-106",
        diagnosis: "Delivery with complications - CS",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-02T09:00:00Z",
        items: [
          {
            code: "DELIVERY_CS",
            qty: 1,
            unitKes: 25000,
            description: "Caesarean section",
          },
          {
            code: "ANC",
            qty: 2,
            unitKes: 500,
            description: "Pre-op antenatal checks",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 2000,
            description: "Post-op medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-107",
        diagnosis: "Panel lab work-up",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-04T09:00:00Z",
        items: [
          {
            code: "CBC",
            qty: 12,
            unitKes: 500,
            description: "Repeat CBC panel",
          },
          {
            code: "URINALYSIS",
            qty: 1,
            unitKes: 300,
            description: "Urinalysis",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-108",
        diagnosis: "Head injury - needs CT",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-06T15:00:00Z",
        items: [
          {
            code: "CT_SCAN",
            qty: 1,
            unitKes: 8000,
            description: "Head CT scan",
          },
        ],
      },
      // ── Contextual rule: R-013 Capacity exceeded ──
      {
        patientRef: "PAT-SYN-127",
        diagnosis: "Mass casualty incident - emergency imaging",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-13T08:00:00Z",
        items: [
          { code: "X_RAY", qty: 20, unitKes: 1500, description: "Batch trauma X-rays" },
          { code: "CONSULTATION", qty: 15, unitKes: 500, description: "Emergency consultations" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-104",
    name: "Nakuru County Referral Hospital",
    type: "COUNTY_REFERRAL_HOSPITAL",
    county: "Nakuru",
    address: "Kenyatta Avenue",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "HIV_TEST",
      "TB_SCREEN",
      "BLOOD_GROUP",
      "X_RAY",
      "ULTRASOUND",
      "CT_SCAN",
      "SURGERY_MAJOR",
      "ORTHO_SURGERY",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "DENTAL",
      "PHARMACY",
      "EMERGENCY",
      "AMBULANCE",
      "ICU",
      "PHYSIOTHERAPY",
      "MENTAL_HEALTH",
    ],
    userName: "Esther Chebet",
    userEmail: "esther@nakurureferral.go.ke",
    facilityLevel: "COUNTY_REFERRAL",
    claims: [
      {
        patientRef: "PAT-SYN-109",
        diagnosis: "Road traffic accident - major surgery",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-02T05:00:00Z",
        items: [
          {
            code: "SURGERY_MAJOR",
            qty: 1,
            unitKes: 180000,
            description: "Emergency laparotomy",
          },
          {
            code: "ICU",
            qty: 3,
            unitKes: 15000,
            description: "ICU admission (per day)",
          },
          {
            code: "X_RAY",
            qty: 2,
            unitKes: 1500,
            description: "Trauma X-rays",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 5000,
            description: "Post-op medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-110",
        diagnosis: "Complex orthopedic surgery with prolonged ICU stay",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-05T07:00:00Z",
        items: [
          {
            code: "ORTHO_SURGERY",
            qty: 1,
            unitKes: 450000,
            description: "Hip reconstruction",
          },
          {
            code: "ICU",
            qty: 12,
            unitKes: 15000,
            description: "ICU admission (per day)",
          },
          {
            code: "SURGERY_MAJOR",
            qty: 1,
            unitKes: 200000,
            description: "Follow-up surgical intervention",
          },
        ],
        ai: {
          provider: "groq",
          model: "llama-3.1-70b-versatile",
          overallAssessment: "HIGH_RISK",
          confidence: 0.83,
          summary:
            "Extended ICU stay and combined surgical billing exceed typical case cost",
          findingType: "AMOUNT_ANOMALY",
          findingSeverity: FindingSeverity.HIGH,
          findingExplanation:
            "Combined surgery and 12-day ICU stay is well above the regional case average",
          scoreImpact: 18,
        },
        review: { officer: "sarah", status: ReviewStatus.PENDING },
      },
      {
        patientRef: "PAT-SYN-111",
        diagnosis: "Mental health outpatient session",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-06T12:00:00Z",
        items: [
          {
            code: "MENTAL_HEALTH",
            qty: 1,
            unitKes: 1000,
            description: "Counselling session",
          },
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 150,
            description: "Intake consultation",
          },
        ],
      },
      // ── Contextual rule: R-007 Equipment unavailability ──
      {
        patientRef: "PAT-SYN-125",
        diagnosis: "Suspected pulmonary embolism - urgent CT needed",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-12T14:00:00Z",
        items: [
          { code: "CT_SCAN", qty: 2, unitKes: 8000, description: "CT pulmonary angiogram" },
          { code: "SPECIALIST_CONSULT", qty: 1, unitKes: 1000, description: "Pulmonology consultation" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-105",
    name: "Eldoret National Referral Hospital",
    type: "NATIONAL_REFERRAL_HOSPITAL",
    county: "Uasin Gishu",
    address: "Uganda Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: ALL_SERVICE_CODES,
    userName: "Dr. Kiplangat Rono",
    userEmail: "kiplangat@eldoretnrh.go.ke",
    facilityLevel: "NATIONAL_REFERRAL",
    claims: [
      {
        patientRef: "PAT-SYN-112",
        diagnosis: "Renal failure - dialysis sessions",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-01T07:00:00Z",
        items: [
          {
            code: "DIALYSIS",
            qty: 8,
            unitKes: 8000,
            description: "Dialysis sessions",
          },
          {
            code: "BLOOD_CHEM",
            qty: 1,
            unitKes: 1500,
            description: "Renal panel",
          },
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 200,
            description: "Nephrology consult",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-113",
        diagnosis: "Cancer treatment - chemotherapy course",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-04T08:00:00Z",
        items: [
          {
            code: "CHEMOTHERAPY",
            qty: 6,
            unitKes: 50000,
            description: "Chemotherapy sessions",
          },
          { code: "CT_SCAN", qty: 1, unitKes: 8000, description: "Staging CT" },
          {
            code: "ICU",
            qty: 15,
            unitKes: 15000,
            description: "ICU admission (per day)",
          },
        ],
        ai: {
          provider: "openrouter",
          model: "anthropic/claude-3-haiku",
          overallAssessment: "MODERATE_RISK",
          confidence: 0.7,
          summary:
            "Extended ICU stay alongside chemotherapy course is atypical for this diagnosis",
          findingType: "QUANTITY_ANOMALY",
          findingSeverity: FindingSeverity.MEDIUM,
          findingExplanation:
            "15-day ICU stay attached to a routine chemo course is unusual",
          scoreImpact: 12,
        },
      },
      {
        patientRef: "PAT-SYN-114",
        diagnosis: "Multi-organ trauma - emergency major surgery",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-07T03:00:00Z",
        items: [
          {
            code: "SURGERY_MAJOR",
            qty: 2,
            unitKes: 400000,
            description: "Emergency surgical repair",
          },
          {
            code: "ICU",
            qty: 20,
            unitKes: 15000,
            description: "ICU admission (per day)",
          },
          {
            code: "AMBULANCE",
            qty: 1,
            unitKes: 5000,
            description: "Emergency transport",
          },
        ],
        ai: {
          provider: "groq",
          model: "llama-3.1-70b-versatile",
          overallAssessment: "HIGH_RISK",
          confidence: 0.91,
          summary:
            "Very high combined billing with an extended ICU stay warrants manual review",
          findingType: "AMOUNT_ANOMALY",
          findingSeverity: FindingSeverity.CRITICAL,
          findingExplanation:
            "Total claim exceeds KES 1M with a 20-day ICU stay",
          scoreImpact: 20,
        },
        review: { officer: "michael", status: ReviewStatus.IN_PROGRESS },
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-001",
    name: "Nairobi General Hospital",
    type: "GENERAL_HOSPITAL",
    county: "Nairobi",
    address: "Kenyatta Avenue",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "SPECIALIST_CONSULT",
      "MALARIA_TEST",
      "CBC",
      "URINALYSIS",
      "BLOOD_CHEM",
      "X_RAY",
      "ULTRASOUND",
      "SURGERY_MINOR",
      "SURGERY_MAJOR",
      "ANC",
      "DELIVERY_NORMAL",
      "DELIVERY_CS",
      "POSTNATAL",
      "DENTAL",
      "PHARMACY",
      "EMERGENCY",
      "ICU",
    ],
    userName: "James Mwangi",
    userEmail: "james@nairobigen.co.ke",
    facilityLevel: "SUB_COUNTY_HOSPITAL",
    claims: [
      {
        patientRef: "PAT-SYN-001",
        diagnosis: "Upper respiratory tract infection",
        status: ClaimStatus.RECEIVED,
        submittedAt: "2026-08-01T09:00:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 1500,
            description: "Initial consultation",
          },
          {
            code: "MALARIA_TEST",
            qty: 2,
            unitKes: 500,
            description: "Malaria RDT",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 2000,
            description: "Antibiotics",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-002",
        diagnosis: "Malaria - uncomplicated",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-03T10:30:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 1500,
            description: "Follow-up consultation",
          },
          {
            code: "MALARIA_TEST",
            qty: 1,
            unitKes: 500,
            description: "Malaria RDT",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 800,
            description: "ACT medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-003",
        diagnosis: "Normal delivery - uncomplicated",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-05T14:00:00Z",
        items: [
          {
            code: "DELIVERY_NORMAL",
            qty: 1,
            unitKes: 30000,
            description: "Normal delivery",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 5000,
            description: "Post-delivery medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-115",
        diagnosis: "Chronic kidney disease - needs dialysis",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-09T09:00:00Z",
        items: [
          {
            code: "DIALYSIS",
            qty: 3,
            unitKes: 8000,
            description: "Dialysis sessions",
          },
        ],
      },
      // ── Contextual rule: R-008 Equipment capacity exceeded ──
      {
        patientRef: "PAT-SYN-120",
        diagnosis: "Mass casualty screening - batch imaging",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-12T09:00:00Z",
        items: [
          { code: "X_RAY", qty: 25, unitKes: 1500, description: "Batch trauma X-rays for 25 patients" },
          { code: "CONSULTATION", qty: 10, unitKes: 1500, description: "Triage consultations" },
        ],
      },
      // ── Contextual rule: R-011 Billing limits exceeded ──
      {
        patientRef: "PAT-SYN-124",
        diagnosis: "Multi-system workup with surgical intervention",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-13T10:00:00Z",
        items: [
          { code: "SURGERY_MAJOR", qty: 1, unitKes: 200000, description: "Emergency surgical intervention" },
          { code: "ICU", qty: 5, unitKes: 15000, description: "ICU admission (per day)" },
          { code: "PHARMACY", qty: 1, unitKes: 10000, description: "Post-operative medication" },
        ],
      },
      // ── Contextual rule: R-015 Patient spending anomaly ──
      {
        patientRef: "PAT-SYN-128",
        diagnosis: "Chronic oncology condition - intensive treatment",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-14T08:00:00Z",
        items: [
          { code: "SPECIALIST_CONSULT", qty: 3, unitKes: 5000, description: "Oncology consultations" },
          { code: "CHEMOTHERAPY", qty: 2, unitKes: 50000, description: "Chemotherapy sessions" },
          { code: "ICU", qty: 10, unitKes: 15000, description: "ICU monitoring (per day)" },
          { code: "MRI", qty: 2, unitKes: 15000, description: "Follow-up MRI scans" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-002",
    name: "Coast Medical Centre",
    type: "MEDICAL_CENTER",
    county: "Mombasa",
    address: "Moi Avenue",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: ["CONSULTATION", "MALARIA_TEST", "X_RAY", "PHARMACY"],
    userName: "Amina Hassan",
    userEmail: "amina@coastmedical.co.ke",
    facilityLevel: "HEALTH_CENTER",
    claims: [
      {
        patientRef: "PAT-SYN-004",
        diagnosis: "Fracture - left radius",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-02T11:00:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 2000,
            description: "Orthopedic consultation",
          },
          {
            code: "X_RAY",
            qty: 2,
            unitKes: 1500,
            description: "X-ray left forearm",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 3500,
            description: "Pain medication and cast materials",
          },
          { code: "MRI", qty: 1, unitKes: 15000, description: "Follow-up MRI" },
        ],
        ai: {
          provider: "groq",
          model: "llama-3.1-70b-versatile",
          overallAssessment: "HIGH_RISK",
          confidence: 0.85,
          summary: "Claim contains an MRI service outside facility scope",
          findingType: "SERVICE_RELEVANCE",
          findingSeverity: FindingSeverity.HIGH,
          findingExplanation:
            "MRI claimed but facility verification shows no radiology/MRI capability",
          scoreImpact: 15,
        },
        review: { officer: "sarah", status: ReviewStatus.IN_PROGRESS },
      },
      {
        patientRef: "PAT-SYN-005",
        diagnosis: "Severe malaria with complications",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-04T08:15:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 3,
            unitKes: 2000,
            description: "Emergency consultation",
          },
          {
            code: "MALARIA_TEST",
            qty: 5,
            unitKes: 500,
            description: "Malaria test",
          },
          {
            code: "PHARMACY",
            qty: 12,
            unitKes: 400,
            description: "IV medication",
          },
        ],
        ai: {
          provider: "groq",
          model: "llama-3.1-70b-versatile",
          overallAssessment: "MODERATE_RISK",
          confidence: 0.72,
          summary:
            "Quantities appear elevated for standard malaria treatment protocol",
          findingType: "QUANTITY_ANOMALY",
          findingSeverity: FindingSeverity.MEDIUM,
          findingExplanation:
            "3 consultations and 12 pharmacy units in a single visit is unusual",
          scoreImpact: 13,
        },
        review: {
          officer: "michael",
          status: ReviewStatus.COMPLETED,
          outcome: "CONFIRMED_ANOMALY",
          notes:
            "Confirmed unusual billing pattern. Quantities exceed standard protocols.",
        },
        alertStatus: "RESOLVED",
      },
      // ── Contextual rule: R-009 Tariff exceeded ──
      {
        patientRef: "PAT-SYN-121",
        diagnosis: "Specialist cardiac evaluation",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-12T11:00:00Z",
        items: [
          { code: "CONSULTATION", qty: 1, unitKes: 8000, description: "Specialist cardiac consultation" },
          { code: "PHARMACY", qty: 1, unitKes: 3000, description: "Cardiac medication" },
          { code: "X_RAY", qty: 1, unitKes: 2000, description: "Chest X-ray" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-003",
    name: "Rift Valley Clinic",
    type: "CLINIC",
    county: "Nakuru",
    address: "Kenyatta Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.UNVERIFIED,
    services: ["CONSULTATION", "PHARMACY"],
    userName: "Peter Kiprop",
    userEmail: "peter@riftvalley.co.ke",
    facilityLevel: "DISPENSARY",
    claims: [
      {
        patientRef: "PAT-SYN-006",
        diagnosis: "Chronic back pain",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-06T09:45:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 1000,
            description: "General consultation",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 800,
            description: "Pain relief medication",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-007",
        diagnosis: "MRI scan - lumbar spine",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-07T10:00:00Z",
        items: [
          {
            code: "MRI",
            qty: 1,
            unitKes: 15000,
            description: "MRI lumbar spine",
          },
        ],
      },
      // ── Contextual rule: R-012 Facility level mismatch ──
      {
        patientRef: "PAT-SYN-122",
        diagnosis: "Emergency caesarean section",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-13T04:00:00Z",
        items: [
          { code: "DELIVERY_CS", qty: 1, unitKes: 25000, description: "Caesarean section" },
          { code: "SURGERY_MINOR", qty: 1, unitKes: 5000, description: "Post-operative wound care" },
          { code: "PHARMACY", qty: 1, unitKes: 3000, description: "Post-surgical medication" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-004",
    name: "Western Province Hospital",
    type: "GENERAL_HOSPITAL",
    county: "Kisumu",
    address: "Oginga Odinga Street",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "CBC",
      "X_RAY",
      "ULTRASOUND",
      "PHARMACY",
      "EMERGENCY",
    ],
    userName: "Grace Otieno",
    userEmail: "grace@westernprov.co.ke",
    facilityLevel: "SUB_COUNTY_HOSPITAL",
    claims: [
      {
        patientRef: "PAT-SYN-008",
        diagnosis: "Prenatal care - third trimester",
        status: ClaimStatus.ASSESSED,
        submittedAt: "2026-08-01T13:00:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 3,
            unitKes: 1000,
            description: "Prenatal consultation",
          },
          {
            code: "ULTRASOUND",
            qty: 1,
            unitKes: 2000,
            description: "Ultrasound scan",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 1500,
            description: "Prenatal supplements",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-009",
        diagnosis: "Appendicitis - surgical intervention",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-08T07:30:00Z",
        items: [
          {
            code: "SURGERY_MAJOR",
            qty: 1,
            unitKes: 900000,
            description: "Appendectomy",
          },
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 2000,
            description: "Pre-surgical consultation",
          },
          {
            code: "PHARMACY",
            qty: 1,
            unitKes: 5000,
            description: "Post-surgical medication",
          },
        ],
        ai: {
          provider: "openrouter",
          model: "anthropic/claude-3-haiku",
          overallAssessment: "HIGH_RISK",
          confidence: 0.88,
          summary:
            "Surgical claim amount appears significantly above regional average, and surgery is outside facility scope",
          findingType: "AMOUNT_ANOMALY",
          findingSeverity: FindingSeverity.HIGH,
          findingExplanation:
            "Surgical claim total is 3x regional average for appendectomy",
          scoreImpact: 15,
        },
        review: { officer: "sarah", status: ReviewStatus.PENDING },
        alertStatus: "ACKNOWLEDGED",
      },
      // ── Contextual rule: R-014 Service not accredited ──
      {
        patientRef: "PAT-SYN-126",
        diagnosis: "Acute appendicitis - emergency surgical intervention",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-14T07:30:00Z",
        items: [
          { code: "SURGERY_MAJOR", qty: 1, unitKes: 150000, description: "Appendectomy" },
          { code: "CONSULTATION", qty: 1, unitKes: 2000, description: "Pre-surgical consultation" },
          { code: "PHARMACY", qty: 1, unitKes: 5000, description: "Post-surgical medication" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-005",
    name: "Highland Specialized Hospital",
    type: "SPECIALIST_HOSPITAL",
    county: "Nyeri",
    address: "Kenyatta Road",
    status: HospitalStatus.SUSPENDED,
    verificationStatus: VerificationStatus.REJECTED,
    services: [],
    userName: "David Mutua",
    userEmail: "david@highland.co.ke",
    facilityLevel: "COUNTY_REFERRAL",
    claims: [
      {
        patientRef: "PAT-SYN-010",
        diagnosis: "General checkup",
        status: ClaimStatus.RECEIVED,
        submittedAt: "2026-08-09T11:20:00Z",
        items: [
          {
            code: "CONSULTATION",
            qty: 1,
            unitKes: 950,
            description: "General checkup",
          },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-106",
    name: "Savannah Specialist & Cancer Centre",
    type: "SPECIALIST_HOSPITAL",
    county: "Nairobi",
    address: "Ngong Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "SPECIALIST_CONSULT",
      "CBC",
      "BLOOD_CHEM",
      "CT_SCAN",
      "MRI",
      "CHEMOTHERAPY",
      "DIALYSIS",
      "ICU",
      "PHARMACY",
    ],
    userName: "Dr. Nasra Ali",
    userEmail: "nasra@savannahcancer.co.ke",
    facilityLevel: "COUNTY_REFERRAL",
    claims: [
      {
        patientRef: "PAT-SYN-116",
        diagnosis: "Breast cancer - staging and chemotherapy",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-03T09:00:00Z",
        items: [
          { code: "MRI", qty: 1, unitKes: 15000, description: "Staging MRI" },
          {
            code: "CHEMOTHERAPY",
            qty: 4,
            unitKes: 50000,
            description: "Chemotherapy sessions",
          },
          {
            code: "SPECIALIST_CONSULT",
            qty: 1,
            unitKes: 1000,
            description: "Oncology consult",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-117",
        diagnosis: "Referral for normal delivery",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-06T09:00:00Z",
        items: [
          {
            code: "DELIVERY_NORMAL",
            qty: 1,
            unitKes: 30000,
            description: "Normal delivery",
          },
        ],
      },
      // ── Contextual rule: R-009 Tariff exceeded (maxPerService) ──
      {
        patientRef: "PAT-SYN-131",
        diagnosis: "Aggressive lymphoma - intensive chemotherapy",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-11T09:00:00Z",
        items: [
          { code: "CHEMOTHERAPY", qty: 5, unitKes: 50000, description: "Intensive chemotherapy cycle" },
          { code: "MRI", qty: 1, unitKes: 15000, description: "Treatment response MRI" },
          { code: "SPECIALIST_CONSULT", qty: 3, unitKes: 1000, description: "Oncology consultations" },
        ],
      },
    ],
  },
  {
    facilityIdentifier: "HOSP-107",
    name: "Tumaini Maternity Home",
    type: "MATERNITY_HOME",
    county: "Nairobi",
    address: "Ngong Road",
    status: HospitalStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    services: [
      "CONSULTATION",
      "ANC",
      "DELIVERY_NORMAL",
      "POSTNATAL",
      "ULTRASOUND",
      "PHARMACY",
    ],
    userName: "Mercy Auma",
    userEmail: "mercy@tumainimaternity.co.ke",
    facilityLevel: "HEALTH_CENTER",
    claims: [
      {
        patientRef: "PAT-SYN-118",
        diagnosis: "Normal delivery - first pregnancy",
        status: ClaimStatus.CLEARED,
        submittedAt: "2026-08-02T06:00:00Z",
        items: [
          {
            code: "ANC",
            qty: 3,
            unitKes: 500,
            description: "Antenatal visits",
          },
          {
            code: "DELIVERY_NORMAL",
            qty: 1,
            unitKes: 30000,
            description: "Normal delivery",
          },
          {
            code: "POSTNATAL",
            qty: 1,
            unitKes: 800,
            description: "Postnatal check",
          },
          {
            code: "ULTRASOUND",
            qty: 1,
            unitKes: 1500,
            description: "Antenatal ultrasound",
          },
        ],
      },
      {
        patientRef: "PAT-SYN-119",
        diagnosis: "Delivery complications - needs major surgery",
        status: ClaimStatus.FLAGGED,
        submittedAt: "2026-08-07T04:00:00Z",
        items: [
          {
            code: "SURGERY_MAJOR",
            qty: 1,
            unitKes: 150000,
            description: "Emergency surgical intervention",
          },
        ],
        review: { officer: "sarah", status: ReviewStatus.PENDING },
      },
      // ── Contextual rule: R-007 Equipment unavailability + R-012 Facility level mismatch ──
      {
        patientRef: "PAT-SYN-130",
        diagnosis: "Post-delivery complications requiring advanced imaging",
        status: ClaimStatus.SUBMITTED,
        submittedAt: "2026-08-13T16:00:00Z",
        items: [
          { code: "CT_SCAN", qty: 1, unitKes: 8000, description: "Emergency CT scan" },
          { code: "SPECIALIST_CONSULT", qty: 1, unitKes: 1000, description: "Specialist consultation" },
        ],
      },
    ],
  },
]

// Draft claim (no rule evaluation / risk / alert - matches a real in-progress draft)
const DRAFT_CLAIM = {
  hospitalFacilityIdentifier: "HOSP-001",
  patientRef: "PAT-SYN-011",
  diagnosis: "Pending diagnosis",
  items: [
    {
      code: "CONSULTATION",
      qty: 1,
      unitKes: 1500,
      description: "Consultation (draft)",
    },
  ],
}

// ─── Facility Level definitions ──────────────────────
type FacilityLevelDef = {
  code: string
  name: string
  description: string
  rank: number
}

const FACILITY_LEVEL_DEFS: FacilityLevelDef[] = [
  {
    code: "DISPENSARY",
    name: "Dispensary",
    description: "Basic healthcare facility providing outpatient services",
    rank: 1,
  },
  {
    code: "HEALTH_CENTER",
    name: "Health Centre",
    description: "Primary care facility with basic inpatient services",
    rank: 2,
  },
  {
    code: "SUB_COUNTY_HOSPITAL",
    name: "Sub-County Hospital",
    description: "Referral facility serving a sub-county with basic surgical services",
    rank: 3,
  },
  {
    code: "COUNTY_REFERRAL",
    name: "County Referral Hospital",
    description: "County-level referral hospital with specialist services",
    rank: 4,
  },
  {
    code: "NATIONAL_REFERRAL",
    name: "National Referral Hospital",
    description: "National-level referral hospital with full range of services",
    rank: 5,
  },
]

// ─── Equipment Type definitions ──────────────────────
type EquipmentTypeDef = {
  code: string
  name: string
  description: string
  category: string
}

const EQUIPMENT_TYPE_DEFS: EquipmentTypeDef[] = [
  {
    code: "MRI_SCANNER",
    name: "MRI Scanner",
    description: "Magnetic Resonance Imaging scanner",
    category: "IMAGING",
  },
  {
    code: "CT_SCANNER",
    name: "CT Scanner",
    description: "Computed Tomography scanner",
    category: "IMAGING",
  },
  {
    code: "X_RAY_MACHINE",
    name: "X-Ray Machine",
    description: "Radiographic imaging machine",
    category: "IMAGING",
  },
  {
    code: "ULTRASOUND",
    name: "Ultrasound Machine",
    description: "Diagnostic ultrasound machine",
    category: "IMAGING",
  },
  {
    code: "DIALYSIS_MACHINE",
    name: "Dialysis Machine",
    description: "Renal dialysis machine",
    category: "THERAPEUTIC",
  },
  {
    code: "VENTILATOR",
    name: "Ventilator",
    description: "Mechanical ventilation machine",
    category: "CRITICAL_CARE",
  },
  {
    code: "DEFIBRILLATOR",
    name: "Defibrillator",
    description: "Automated external defibrillator",
    category: "EMERGENCY",
  },
]

// ─── Staff Type definitions ──────────────────────────
type StaffTypeDef = {
  code: string
  name: string
  description: string
  category: string
}

const STAFF_TYPE_DEFS: StaffTypeDef[] = [
  {
    code: "PHYSICIAN",
    name: "Physician",
    description: "Medical doctor / general practitioner",
    category: "CLINICAL",
  },
  {
    code: "SPECIALIST",
    name: "Specialist",
    description: "Specialist physician",
    category: "CLINICAL",
  },
  {
    code: "NURSE",
    name: "Nurse",
    description: "Registered nurse",
    category: "NURSING",
  },
  {
    code: "LAB_TECHNICIAN",
    name: "Laboratory Technician",
    description: "Laboratory technologist / technician",
    category: "LABORATORY",
  },
  {
    code: "RADIOGRAPHER",
    name: "Radiographer",
    description: "Radiology technologist",
    category: "RADIOLOGY",
  },
  {
    code: "PHARMACIST",
    name: "Pharmacist",
    description: "Licensed pharmacist",
    category: "PHARMACY",
  },
  {
    code: "SURGEON",
    name: "Surgeon",
    description: "Surgical specialist",
    category: "SURGICAL",
  },
  {
    code: "ANAESTHETIST",
    name: "Anaesthetist",
    description: "Anaesthesia specialist",
    category: "SURGICAL",
  },
]

// ─── Service Requirements ────────────────────────────
type ServiceRequirementDef = {
  serviceCode: string
  requirementType: string
  requirementCode: string
  isRequired: boolean
  notes?: string
}

const SERVICE_REQUIREMENT_DEFS: ServiceRequirementDef[] = [
  {
    serviceCode: "MRI",
    requirementType: "EQUIPMENT",
    requirementCode: "MRI_SCANNER",
    isRequired: true,
    notes: "MRI scan requires MRI scanner",
  },
  {
    serviceCode: "CT_SCAN",
    requirementType: "EQUIPMENT",
    requirementCode: "CT_SCANNER",
    isRequired: true,
    notes: "CT scan requires CT scanner",
  },
  {
    serviceCode: "X_RAY",
    requirementType: "EQUIPMENT",
    requirementCode: "X_RAY_MACHINE",
    isRequired: true,
    notes: "X-ray requires X-ray machine",
  },
  {
    serviceCode: "ULTRASOUND",
    requirementType: "EQUIPMENT",
    requirementCode: "ULTRASOUND",
    isRequired: true,
    notes: "Ultrasound requires ultrasound machine",
  },
  {
    serviceCode: "DIALYSIS",
    requirementType: "EQUIPMENT",
    requirementCode: "DIALYSIS_MACHINE",
    isRequired: true,
    notes: "Dialysis requires dialysis machine",
  },
  {
    serviceCode: "ICU",
    requirementType: "EQUIPMENT",
    requirementCode: "VENTILATOR",
    isRequired: true,
    notes: "ICU requires ventilator",
  },
  {
    serviceCode: "ICU",
    requirementType: "EQUIPMENT",
    requirementCode: "DEFIBRILLATOR",
    isRequired: true,
    notes: "ICU requires defibrillator",
  },
  {
    serviceCode: "EMERGENCY",
    requirementType: "EQUIPMENT",
    requirementCode: "DEFIBRILLATOR",
    isRequired: true,
    notes: "Emergency services require defibrillator",
  },
  {
    serviceCode: "SURGERY_MAJOR",
    requirementType: "STAFF",
    requirementCode: "SURGEON",
    isRequired: true,
    notes: "Major surgery requires surgeon",
  },
  {
    serviceCode: "SURGERY_MAJOR",
    requirementType: "STAFF",
    requirementCode: "ANAESTHETIST",
    isRequired: true,
    notes: "Major surgery requires anaesthetist",
  },
  {
    serviceCode: "SURGERY_MINOR",
    requirementType: "STAFF",
    requirementCode: "SURGEON",
    isRequired: true,
    notes: "Minor surgery requires surgeon",
  },
  {
    serviceCode: "DELIVERY_CS",
    requirementType: "STAFF",
    requirementCode: "SURGEON",
    isRequired: true,
    notes: "Caesarean section requires surgeon",
  },
  {
    serviceCode: "DELIVERY_CS",
    requirementType: "STAFF",
    requirementCode: "ANAESTHETIST",
    isRequired: true,
    notes: "Caesarean section requires anaesthetist",
  },
  {
    serviceCode: "CHEMOTHERAPY",
    requirementType: "STAFF",
    requirementCode: "SPECIALIST",
    isRequired: true,
    notes: "Chemotherapy requires oncologist",
  },
  {
    serviceCode: "MALARIA_TEST",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "Malaria test requires lab technician",
  },
  {
    serviceCode: "CBC",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "CBC requires lab technician",
  },
  {
    serviceCode: "URINALYSIS",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "Urinalysis requires lab technician",
  },
  {
    serviceCode: "BLOOD_CHEM",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "Blood chemistry requires lab technician",
  },
  {
    serviceCode: "HIV_TEST",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "HIV test requires lab technician",
  },
  {
    serviceCode: "TB_SCREEN",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "TB screening requires lab technician",
  },
  {
    serviceCode: "BLOOD_GROUP",
    requirementType: "STAFF",
    requirementCode: "LAB_TECHNICIAN",
    isRequired: true,
    notes: "Blood grouping requires lab technician",
  },
  {
    serviceCode: "X_RAY",
    requirementType: "STAFF",
    requirementCode: "RADIOGRAPHER",
    isRequired: true,
    notes: "X-ray requires radiographer",
  },
  {
    serviceCode: "CT_SCAN",
    requirementType: "STAFF",
    requirementCode: "RADIOGRAPHER",
    isRequired: true,
    notes: "CT scan requires radiographer",
  },
  {
    serviceCode: "MRI",
    requirementType: "STAFF",
    requirementCode: "RADIOGRAPHER",
    isRequired: true,
    notes: "MRI requires radiographer",
  },
  {
    serviceCode: "PHARMACY",
    requirementType: "STAFF",
    requirementCode: "PHARMACIST",
    isRequired: true,
    notes: "Pharmacy requires pharmacist",
  },
]

// ─── Billing Policy definitions ──────────────────────
type BillingPolicyDef = {
  facilityLevelCode: string
  serviceCode?: string
  maxPerEncounter?: number
  maxPerService?: number
  maxQtyPerService?: number
  maxDailyAmount?: number
  maxMonthlyAmount?: number
}

const BILLING_POLICY_DEFS: BillingPolicyDef[] = [
  // Dispensary level limits
  {
    facilityLevelCode: "DISPENSARY",
    maxPerEncounter: kes(10_000),
    maxPerService: kes(5_000),
    maxQtyPerService: 5,
    maxDailyAmount: kes(15_000),
  },
  // Health centre level limits
  {
    facilityLevelCode: "HEALTH_CENTER",
    maxPerEncounter: kes(50_000),
    maxPerService: kes(30_000),
    maxQtyPerService: 10,
    maxDailyAmount: kes(75_000),
  },
  // Sub-county hospital level limits
  {
    facilityLevelCode: "SUB_COUNTY_HOSPITAL",
    maxPerEncounter: kes(200_000),
    maxPerService: kes(100_000),
    maxQtyPerService: 20,
    maxDailyAmount: kes(300_000),
  },
  // County referral level limits
  {
    facilityLevelCode: "COUNTY_REFERRAL",
    maxPerEncounter: kes(500_000),
    maxPerService: kes(200_000),
    maxQtyPerService: 30,
    maxDailyAmount: kes(600_000),
  },
  // National referral - higher limits
  {
    facilityLevelCode: "NATIONAL_REFERRAL",
    maxPerEncounter: kes(2_000_000),
    maxPerService: kes(1_000_000),
    maxQtyPerService: 50,
    maxDailyAmount: kes(2_500_000),
  },
  // Surgery-specific limits
  {
    facilityLevelCode: "SUB_COUNTY_HOSPITAL",
    serviceCode: "SURGERY_MAJOR",
    maxPerEncounter: kes(200_000),
    maxQtyPerService: 3,
  },
  {
    facilityLevelCode: "COUNTY_REFERRAL",
    serviceCode: "SURGERY_MAJOR",
    maxPerEncounter: kes(500_000),
    maxQtyPerService: 5,
  },
  // ICU limits
  {
    facilityLevelCode: "COUNTY_REFERRAL",
    serviceCode: "ICU",
    maxPerEncounter: kes(300_000),
    maxQtyPerService: 30,
    maxDailyAmount: kes(30_000),
  },
]

// ─── Service Tariff definitions ──────────────────────
type ServiceTariffDef = {
  serviceCode: string
  facilityLevelCode?: string
  unitAmountKes: number
  minAmountKes?: number
  maxAmountKes?: number
  patientCategory?: string
}

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

// ─── Facility Level Capability definitions ───────────
type FacilityLevelCapabilityDef = {
  facilityLevelCode: string
  serviceCode: string
  isExpected: boolean
  isAllowed: boolean
  requiresAccreditation: boolean
}

const FACILITY_LEVEL_CAPABILITY_DEFS: FacilityLevelCapabilityDef[] = [
  // Dispensary capabilities
  { facilityLevelCode: "DISPENSARY", serviceCode: "CONSULTATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "PHARMACY", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "IMMUNIZATION", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "FAMILY_PLANNING", isExpected: true, isAllowed: true, requiresAccreditation: false },
  { facilityLevelCode: "DISPENSARY", serviceCode: "MALARIA_TEST", isExpected: false, isAllowed: true, requiresAccreditation: false },
  // Health centre capabilities
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
  // Sub-county hospital capabilities
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
  // County referral capabilities
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
  // National referral - all services allowed
  ...ALL_SERVICE_CODES.map((code) => ({
    facilityLevelCode: "NATIONAL_REFERRAL",
    serviceCode: code,
    isExpected: true,
    isAllowed: true,
    requiresAccreditation: false,
  })),
]

// ─── Hospital Equipment mapping ──────────────────────
type HospitalEquipmentDef = {
  facilityIdentifier: string
  equipmentCode: string
  quantity: number
  operationalQuantity: number
  status: EquipmentStatus
  notes?: string
}

const HOSPITAL_EQUIPMENT_DEFS: HospitalEquipmentDef[] = [
  // Sub-county hospitals
  { facilityIdentifier: "HOSP-103", equipmentCode: "X_RAY_MACHINE", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-103", equipmentCode: "ULTRASOUND", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-103", equipmentCode: "CT_SCANNER", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-001", equipmentCode: "X_RAY_MACHINE", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-001", equipmentCode: "ULTRASOUND", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-001", equipmentCode: "VENTILATOR", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-001", equipmentCode: "DEFIBRILLATOR", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-004", equipmentCode: "X_RAY_MACHINE", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-004", equipmentCode: "ULTRASOUND", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  // County referral hospitals
  { facilityIdentifier: "HOSP-104", equipmentCode: "X_RAY_MACHINE", quantity: 3, operationalQuantity: 3, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-104", equipmentCode: "ULTRASOUND", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-104", equipmentCode: "CT_SCANNER", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.MAINTENANCE, notes: "Under scheduled maintenance" },
  { facilityIdentifier: "HOSP-104", equipmentCode: "VENTILATOR", quantity: 5, operationalQuantity: 5, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-104", equipmentCode: "DEFIBRILLATOR", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-005", equipmentCode: "X_RAY_MACHINE", quantity: 1, operationalQuantity: 0, status: EquipmentStatus.RETIRED },
  { facilityIdentifier: "HOSP-106", equipmentCode: "CT_SCANNER", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-106", equipmentCode: "MRI_SCANNER", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-106", equipmentCode: "VENTILATOR", quantity: 3, operationalQuantity: 3, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-106", equipmentCode: "DIALYSIS_MACHINE", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  // National referral
  { facilityIdentifier: "HOSP-105", equipmentCode: "MRI_SCANNER", quantity: 2, operationalQuantity: 2, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "CT_SCANNER", quantity: 3, operationalQuantity: 3, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "X_RAY_MACHINE", quantity: 4, operationalQuantity: 4, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "ULTRASOUND", quantity: 3, operationalQuantity: 3, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "DIALYSIS_MACHINE", quantity: 5, operationalQuantity: 5, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "VENTILATOR", quantity: 10, operationalQuantity: 10, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-105", equipmentCode: "DEFIBRILLATOR", quantity: 5, operationalQuantity: 5, status: EquipmentStatus.OPERATIONAL },
  // Health centres with basic equipment
  { facilityIdentifier: "HOSP-102", equipmentCode: "ULTRASOUND", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-102", equipmentCode: "DEFIBRILLATOR", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-107", equipmentCode: "ULTRASOUND", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  // Coast Medical Centre - basic equipment
  { facilityIdentifier: "HOSP-002", equipmentCode: "X_RAY_MACHINE", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
  { facilityIdentifier: "HOSP-002", equipmentCode: "DEFIBRILLATOR", quantity: 1, operationalQuantity: 1, status: EquipmentStatus.OPERATIONAL },
]

// ─── Hospital Staff mapping ──────────────────────────
type HospitalStaffDef = {
  facilityIdentifier: string
  staffCode: string
  quantity: number
  activeQuantity: number
}

const HOSPITAL_STAFF_DEFS: HospitalStaffDef[] = [
  // Dispensaries - minimal staff
  { facilityIdentifier: "HOSP-101", staffCode: "PHYSICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-101", staffCode: "NURSE", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-101", staffCode: "PHARMACIST", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-003", staffCode: "PHYSICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-003", staffCode: "NURSE", quantity: 1, activeQuantity: 1 },
  // Health centres
  { facilityIdentifier: "HOSP-102", staffCode: "PHYSICIAN", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-102", staffCode: "NURSE", quantity: 4, activeQuantity: 4 },
  { facilityIdentifier: "HOSP-102", staffCode: "LAB_TECHNICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-102", staffCode: "PHARMACIST", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-107", staffCode: "PHYSICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-107", staffCode: "NURSE", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-107", staffCode: "PHARMACIST", quantity: 1, activeQuantity: 1 },
  // Coast Medical Centre - health centre level staff
  { facilityIdentifier: "HOSP-002", staffCode: "PHYSICIAN", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-002", staffCode: "NURSE", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-002", staffCode: "LAB_TECHNICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-002", staffCode: "RADIOGRAPHER", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-002", staffCode: "PHARMACIST", quantity: 1, activeQuantity: 1 },
  // Sub-county hospitals
  { facilityIdentifier: "HOSP-103", staffCode: "PHYSICIAN", quantity: 4, activeQuantity: 4 },
  { facilityIdentifier: "HOSP-103", staffCode: "SPECIALIST", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-103", staffCode: "NURSE", quantity: 10, activeQuantity: 10 },
  { facilityIdentifier: "HOSP-103", staffCode: "LAB_TECHNICIAN", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-103", staffCode: "RADIOGRAPHER", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-103", staffCode: "PHARMACIST", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-103", staffCode: "SURGEON", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-001", staffCode: "PHYSICIAN", quantity: 5, activeQuantity: 5 },
  { facilityIdentifier: "HOSP-001", staffCode: "SPECIALIST", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-001", staffCode: "NURSE", quantity: 12, activeQuantity: 12 },
  { facilityIdentifier: "HOSP-001", staffCode: "LAB_TECHNICIAN", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-001", staffCode: "RADIOGRAPHER", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-001", staffCode: "PHARMACIST", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-001", staffCode: "SURGEON", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-001", staffCode: "ANAESTHETIST", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-004", staffCode: "PHYSICIAN", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-004", staffCode: "NURSE", quantity: 8, activeQuantity: 8 },
  { facilityIdentifier: "HOSP-004", staffCode: "LAB_TECHNICIAN", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-004", staffCode: "RADIOGRAPHER", quantity: 1, activeQuantity: 1 },
  { facilityIdentifier: "HOSP-004", staffCode: "PHARMACIST", quantity: 1, activeQuantity: 1 },
  // County referral hospitals
  { facilityIdentifier: "HOSP-104", staffCode: "PHYSICIAN", quantity: 8, activeQuantity: 8 },
  { facilityIdentifier: "HOSP-104", staffCode: "SPECIALIST", quantity: 6, activeQuantity: 6 },
  { facilityIdentifier: "HOSP-104", staffCode: "NURSE", quantity: 25, activeQuantity: 25 },
  { facilityIdentifier: "HOSP-104", staffCode: "LAB_TECHNICIAN", quantity: 4, activeQuantity: 4 },
  { facilityIdentifier: "HOSP-104", staffCode: "RADIOGRAPHER", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-104", staffCode: "PHARMACIST", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-104", staffCode: "SURGEON", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-104", staffCode: "ANAESTHETIST", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-106", staffCode: "PHYSICIAN", quantity: 3, activeQuantity: 3 },
  { facilityIdentifier: "HOSP-106", staffCode: "SPECIALIST", quantity: 4, activeQuantity: 4 },
  { facilityIdentifier: "HOSP-106", staffCode: "NURSE", quantity: 15, activeQuantity: 15 },
  { facilityIdentifier: "HOSP-106", staffCode: "RADIOGRAPHER", quantity: 2, activeQuantity: 2 },
  { facilityIdentifier: "HOSP-106", staffCode: "PHARMACIST", quantity: 2, activeQuantity: 2 },
  // National referral
  { facilityIdentifier: "HOSP-105", staffCode: "PHYSICIAN", quantity: 20, activeQuantity: 20 },
  { facilityIdentifier: "HOSP-105", staffCode: "SPECIALIST", quantity: 30, activeQuantity: 30 },
  { facilityIdentifier: "HOSP-105", staffCode: "NURSE", quantity: 80, activeQuantity: 80 },
  { facilityIdentifier: "HOSP-105", staffCode: "LAB_TECHNICIAN", quantity: 10, activeQuantity: 10 },
  { facilityIdentifier: "HOSP-105", staffCode: "RADIOGRAPHER", quantity: 6, activeQuantity: 6 },
  { facilityIdentifier: "HOSP-105", staffCode: "PHARMACIST", quantity: 8, activeQuantity: 8 },
  { facilityIdentifier: "HOSP-105", staffCode: "SURGEON", quantity: 10, activeQuantity: 10 },
  { facilityIdentifier: "HOSP-105", staffCode: "ANAESTHETIST", quantity: 6, activeQuantity: 6 },
]

// ─── Operating Hours definition ───────────────────────
type OperatingHoursDef = {
  dayOfWeek: DayOfWeek
  isOpen: boolean
  openTime: string | null
  closeTime: string | null
  hasEmergency: boolean
  is24Hour: boolean
}

const WEEKDAY_HOURS: OperatingHoursDef[] = [
  { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: "08:00", closeTime: "13:00", hasEmergency: false, is24Hour: false },
  { dayOfWeek: DayOfWeek.SUNDAY, isOpen: false, openTime: null, closeTime: null, hasEmergency: false, is24Hour: false },
]

const WEEKDAY_HOURS_WITH_EMERGENCY: OperatingHoursDef[] = [
  { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: "08:00", closeTime: "17:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: "08:00", closeTime: "13:00", hasEmergency: true, is24Hour: false },
  { dayOfWeek: DayOfWeek.SUNDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
]

// Hospital types and their operating hours pattern
const HOSPITAL_HOURS_PATTERN: Record<string, OperatingHoursDef[]> = {
  DISPENSARY: WEEKDAY_HOURS,
  HEALTH_CENTER: WEEKDAY_HOURS,
  SUB_COUNTY_HOSPITAL: WEEKDAY_HOURS,
  CLINIC: WEEKDAY_HOURS,
  MATERNITY_HOME: WEEKDAY_HOURS,
  MEDICAL_CENTER: WEEKDAY_HOURS,
  GENERAL_HOSPITAL: WEEKDAY_HOURS_WITH_EMERGENCY,
  SPECIALIST_HOSPITAL: WEEKDAY_HOURS_WITH_EMERGENCY,
  COUNTY_REFERRAL_HOSPITAL: WEEKDAY_HOURS_WITH_EMERGENCY,
  NATIONAL_REFERRAL_HOSPITAL: [
    { dayOfWeek: DayOfWeek.MONDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.TUESDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.WEDNESDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.THURSDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.FRIDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.SATURDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
    { dayOfWeek: DayOfWeek.SUNDAY, isOpen: true, openTime: null, closeTime: null, hasEmergency: true, is24Hour: true },
  ],
}

// ─── Service Capacity definitions ────────────────────
type ServiceCapacityDef = {
  facilityIdentifier: string
  serviceCode: string
  theoreticalDailyCapacity: number
  operationalDailyCapacity: number
  weeklyCapacity: number
  monthlyCapacity: number
  averageProcedureDurationMinutes: number
  capacityBasis: CapacityBasis
}

const SERVICE_CAPACITY_DEFS: ServiceCapacityDef[] = [
  // Sub-county hospitals
  { facilityIdentifier: "HOSP-103", serviceCode: "X_RAY", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 15, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-103", serviceCode: "CT_SCAN", theoreticalDailyCapacity: 8, operationalDailyCapacity: 7, weeklyCapacity: 40, monthlyCapacity: 160, averageProcedureDurationMinutes: 30, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-103", serviceCode: "SURGERY_MINOR", theoreticalDailyCapacity: 4, operationalDailyCapacity: 3, weeklyCapacity: 20, monthlyCapacity: 80, averageProcedureDurationMinutes: 60, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-103", serviceCode: "DELIVERY_NORMAL", theoreticalDailyCapacity: 3, operationalDailyCapacity: 3, weeklyCapacity: 15, monthlyCapacity: 60, averageProcedureDurationMinutes: 120, capacityBasis: CapacityBasis.ROOMS },
  { facilityIdentifier: "HOSP-001", serviceCode: "CONSULTATION", theoreticalDailyCapacity: 30, operationalDailyCapacity: 28, weeklyCapacity: 150, monthlyCapacity: 600, averageProcedureDurationMinutes: 20, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-001", serviceCode: "SURGERY_MAJOR", theoreticalDailyCapacity: 3, operationalDailyCapacity: 2, weeklyCapacity: 12, monthlyCapacity: 50, averageProcedureDurationMinutes: 180, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-001", serviceCode: "ICU", theoreticalDailyCapacity: 8, operationalDailyCapacity: 8, weeklyCapacity: 56, monthlyCapacity: 240, averageProcedureDurationMinutes: 1440, capacityBasis: CapacityBasis.ROOMS },
  // County referral hospitals
  { facilityIdentifier: "HOSP-104", serviceCode: "CT_SCAN", theoreticalDailyCapacity: 15, operationalDailyCapacity: 12, weeklyCapacity: 75, monthlyCapacity: 300, averageProcedureDurationMinutes: 30, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-104", serviceCode: "SURGERY_MAJOR", theoreticalDailyCapacity: 5, operationalDailyCapacity: 4, weeklyCapacity: 25, monthlyCapacity: 100, averageProcedureDurationMinutes: 240, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-104", serviceCode: "ICU", theoreticalDailyCapacity: 15, operationalDailyCapacity: 15, weeklyCapacity: 105, monthlyCapacity: 450, averageProcedureDurationMinutes: 1440, capacityBasis: CapacityBasis.ROOMS },
  { facilityIdentifier: "HOSP-104", serviceCode: "EMERGENCY", theoreticalDailyCapacity: 50, operationalDailyCapacity: 45, weeklyCapacity: 350, monthlyCapacity: 1500, averageProcedureDurationMinutes: 30, capacityBasis: CapacityBasis.HOURS },
  { facilityIdentifier: "HOSP-106", serviceCode: "CHEMOTHERAPY", theoreticalDailyCapacity: 6, operationalDailyCapacity: 5, weeklyCapacity: 30, monthlyCapacity: 120, averageProcedureDurationMinutes: 120, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-106", serviceCode: "DIALYSIS", theoreticalDailyCapacity: 10, operationalDailyCapacity: 8, weeklyCapacity: 50, monthlyCapacity: 200, averageProcedureDurationMinutes: 240, capacityBasis: CapacityBasis.EQUIPMENT },
  // National referral
  { facilityIdentifier: "HOSP-105", serviceCode: "MRI", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 45, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-105", serviceCode: "CT_SCAN", theoreticalDailyCapacity: 30, operationalDailyCapacity: 28, weeklyCapacity: 150, monthlyCapacity: 600, averageProcedureDurationMinutes: 30, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-105", serviceCode: "SURGERY_MAJOR", theoreticalDailyCapacity: 10, operationalDailyCapacity: 8, weeklyCapacity: 50, monthlyCapacity: 200, averageProcedureDurationMinutes: 240, capacityBasis: CapacityBasis.STAFF },
  { facilityIdentifier: "HOSP-105", serviceCode: "ICU", theoreticalDailyCapacity: 40, operationalDailyCapacity: 38, weeklyCapacity: 280, monthlyCapacity: 1200, averageProcedureDurationMinutes: 1440, capacityBasis: CapacityBasis.ROOMS },
  { facilityIdentifier: "HOSP-105", serviceCode: "DIALYSIS", theoreticalDailyCapacity: 20, operationalDailyCapacity: 18, weeklyCapacity: 100, monthlyCapacity: 400, averageProcedureDurationMinutes: 240, capacityBasis: CapacityBasis.EQUIPMENT },
  { facilityIdentifier: "HOSP-105", serviceCode: "CHEMOTHERAPY", theoreticalDailyCapacity: 15, operationalDailyCapacity: 14, weeklyCapacity: 75, monthlyCapacity: 300, averageProcedureDurationMinutes: 120, capacityBasis: CapacityBasis.STAFF },
]

async function main() {
  console.log("Seeding database...")

  // Delete in correct order (respect foreign keys)
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

  // ─── Facility Levels ──────────────────────────────────
  const facilityLevels = await Promise.all(
    FACILITY_LEVEL_DEFS.map((fl) => prisma.facilityLevel.create({ data: fl }))
  )
  const facilityLevelMap = Object.fromEntries(facilityLevels.map((fl) => [fl.code, fl]))

  // ─── Equipment Types ──────────────────────────────────
  const equipmentTypes = await Promise.all(
    EQUIPMENT_TYPE_DEFS.map((et) => prisma.equipmentType.create({ data: et }))
  )
  const equipmentTypeMap = Object.fromEntries(equipmentTypes.map((et) => [et.code, et]))

  // ─── Staff Types ──────────────────────────────────────
  const staffTypes = await Promise.all(
    STAFF_TYPE_DEFS.map((st) => prisma.staffType.create({ data: st }))
  )
  const staffTypeMap = Object.fromEntries(staffTypes.map((st) => [st.code, st]))

  // ─── Services ────────────────────────────────────────
  const services = await Promise.all(
    SERVICE_DEFS.map((s) =>
      prisma.service.create({
        data: {
          code: s.code,
          name: s.name,
          description: s.description,
          category: s.category,
          serviceType: s.serviceType,
          isInpatient: s.isInpatient ?? false,
          isEmergency: s.isEmergency ?? false,
        },
      })
    )
  )
  const serviceMap = Object.fromEntries(services.map((s) => [s.code, s]))

  // ─── Compliance Rules ────────────────────────────────
  const rules = await Promise.all(
    RULE_DEFS.map((r) => prisma.complianceRule.create({ data: r }))
  )
  const ruleMap = Object.fromEntries(rules.map((r) => [r.code, r])) as Record<string, RuleWithId>

  // ─── Service Requirements ─────────────────────────────
  const serviceRequirements = await Promise.all(
    SERVICE_REQUIREMENT_DEFS.map((sr) =>
      prisma.serviceRequirement.create({
        data: {
          serviceId: serviceMap[sr.serviceCode].id,
          requirementType: sr.requirementType,
          requirementCode: sr.requirementCode,
          isRequired: sr.isRequired,
          notes: sr.notes,
        },
      })
    )
  )

  // ─── Service Equipment links ──────────────────────────
  const serviceEquipmentLinks = await Promise.all(
    [
      { serviceCode: "MRI", equipmentCode: "MRI_SCANNER" },
      { serviceCode: "CT_SCAN", equipmentCode: "CT_SCANNER" },
      { serviceCode: "X_RAY", equipmentCode: "X_RAY_MACHINE" },
      { serviceCode: "ULTRASOUND", equipmentCode: "ULTRASOUND" },
      { serviceCode: "DIALYSIS", equipmentCode: "DIALYSIS_MACHINE" },
      { serviceCode: "ICU", equipmentCode: "VENTILATOR" },
      { serviceCode: "ICU", equipmentCode: "DEFIBRILLATOR" },
      { serviceCode: "EMERGENCY", equipmentCode: "DEFIBRILLATOR" },
    ].map((se) =>
      prisma.serviceEquipment.create({
        data: {
          serviceId: serviceMap[se.serviceCode].id,
          equipmentTypeId: equipmentTypeMap[se.equipmentCode].id,
          isRequired: true,
          minQuantity: 1,
        },
      })
    )
  )

  // ─── Service Staff links ──────────────────────────────
  const serviceStaffLinks = await Promise.all(
    [
      { serviceCode: "SURGERY_MAJOR", staffCode: "SURGEON" },
      { serviceCode: "SURGERY_MAJOR", staffCode: "ANAESTHETIST" },
      { serviceCode: "SURGERY_MINOR", staffCode: "SURGEON" },
      { serviceCode: "ORTHO_SURGERY", staffCode: "SURGEON" },
      { serviceCode: "ORTHO_SURGERY", staffCode: "ANAESTHETIST" },
      { serviceCode: "DELIVERY_CS", staffCode: "SURGEON" },
      { serviceCode: "DELIVERY_CS", staffCode: "ANAESTHETIST" },
      { serviceCode: "CHEMOTHERAPY", staffCode: "SPECIALIST" },
      { serviceCode: "MALARIA_TEST", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "CBC", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "URINALYSIS", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "BLOOD_CHEM", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "HIV_TEST", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "TB_SCREEN", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "BLOOD_GROUP", staffCode: "LAB_TECHNICIAN" },
      { serviceCode: "X_RAY", staffCode: "RADIOGRAPHER" },
      { serviceCode: "CT_SCAN", staffCode: "RADIOGRAPHER" },
      { serviceCode: "MRI", staffCode: "RADIOGRAPHER" },
      { serviceCode: "PHARMACY", staffCode: "PHARMACIST" },
      { serviceCode: "CONSULTATION", staffCode: "PHYSICIAN" },
      { serviceCode: "SPECIALIST_CONSULT", staffCode: "SPECIALIST" },
      { serviceCode: "ICU", staffCode: "NURSE" },
    ].map((ss) =>
      prisma.serviceStaff.create({
        data: {
          serviceId: serviceMap[ss.serviceCode].id,
          staffTypeId: staffTypeMap[ss.staffCode].id,
          isRequired: true,
          minQuantity: 1,
        },
      })
    )
  )

  // ─── Facility Level Capabilities ──────────────────────
  const facilityLevelCapabilities = await Promise.all(
    FACILITY_LEVEL_CAPABILITY_DEFS.map((flc) =>
      prisma.facilityLevelCapability.create({
        data: {
          facilityLevelId: facilityLevelMap[flc.facilityLevelCode].id,
          serviceId: serviceMap[flc.serviceCode].id,
          isExpected: flc.isExpected,
          isAllowed: flc.isAllowed,
          requiresAccreditation: flc.requiresAccreditation,
        },
      })
    )
  )

  // ─── Service Tariffs ──────────────────────────────────
  const serviceTariffs = await Promise.all(
    SERVICE_TARIFF_DEFS.map((st) =>
      prisma.serviceTariff.create({
        data: {
          serviceId: serviceMap[st.serviceCode].id,
          facilityLevelId: facilityLevelMap[st.facilityLevelCode!].id,
          unitAmountCents: kes(st.unitAmountKes),
          minAmountCents: st.minAmountKes ? kes(st.minAmountKes) : undefined,
          maxAmountCents: st.maxAmountKes ? kes(st.maxAmountKes) : undefined,
          patientCategory: st.patientCategory,
        },
      })
    )
  )

  // ─── Billing Policies ─────────────────────────────────
  const billingPolicies = await Promise.all(
    BILLING_POLICY_DEFS.map((bp) =>
      prisma.billingPolicy.create({
        data: {
          facilityLevelId: facilityLevelMap[bp.facilityLevelCode].id,
          serviceId: bp.serviceCode ? serviceMap[bp.serviceCode].id : undefined,
          maxPerEncounter: bp.maxPerEncounter,
          maxPerService: bp.maxPerService,
          maxQtyPerService: bp.maxQtyPerService,
          maxDailyAmount: bp.maxDailyAmount,
          maxMonthlyAmount: bp.maxMonthlyAmount,
        },
      })
    )
  )

  // ─── SHA staff (created once) ────────────────────────
  const passwordHash = await bcrypt.hash("password", 10)
  const shaOfficer1 = await prisma.user.create({
    data: {
      name: "Dr. Sarah Wanjiku",
      email: "sarah@sha.go.ke",
      passwordHash,
      role: UserRole.SHA_OFFICER,
    },
  })
  const shaOfficer2 = await prisma.user.create({
    data: {
      name: "Michael Ochieng",
      email: "michael@sha.go.ke",
      passwordHash,
      role: UserRole.SHA_OFFICER,
    },
  })
  const admin = await prisma.user.create({
    data: {
      name: "System Admin",
      email: "admin@sha.go.ke",
      passwordHash,
      role: UserRole.ADMIN,
    },
  })
  const officers = { sarah: shaOfficer1, michael: shaOfficer2 }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "SYSTEM_SEEDED",
      entityType: "System",
      entityId: "seed",
    },
  })

  let claimCount = 0
  let itemCount = 0
  let ruleEvalCount = 0
  let findingCount = 0
  let aiAnalysisCount = 0
  let aiFindingCount = 0
  let riskScoreCount = 0
  let reviewCount = 0
  let alertCount = 0
  let auditLogCount = 1
  let patientCount = 0
  let encounterCount = 0
  let serviceHistoryCount = 0
  let equipmentCount = 0
  let staffCount = 0
  let operatingHoursCount = 0
  let hospitalCapabilityCount = 0
  let serviceCapacityCount = 0
  let maintenanceCount = 0

  // ─── Hospitals, services, users, claims ──────────────
  for (const h of HOSPITAL_DEFS) {
    const hospital = await prisma.hospital.create({
      data: {
        facilityIdentifier: h.facilityIdentifier,
        name: h.name,
        type: h.type,
        status: h.status,
        verificationStatus: h.verificationStatus,
        location: { county: h.county, address: h.address },
        facilityLevelId: facilityLevelMap[h.facilityLevel].id,
      },
    })

    for (const code of h.services) {
      await prisma.hospitalService.create({
        data: { hospitalId: hospital.id, serviceId: serviceMap[code].id },
      })
    }

    // Hospital service capabilities (mark accredited for verified hospitals)
    if (h.verificationStatus === VerificationStatus.VERIFIED) {
      for (const code of h.services) {
        const serviceObj = serviceMap[code]
        const levelCapability = await prisma.facilityLevelCapability.findFirst({
          where: {
            facilityLevelId: facilityLevelMap[h.facilityLevel].id,
            serviceId: serviceObj.id,
          },
        })
        await prisma.hospitalServiceCapability.create({
          data: {
            hospitalId: hospital.id,
            serviceId: serviceObj.id,
            isOffered: true,
            isAccredited: levelCapability?.requiresAccreditation ?? false,
            isActive: true,
          },
        })
        hospitalCapabilityCount++
      }
    }

    // Hospital equipment
    const hospitalEquipDefs = HOSPITAL_EQUIPMENT_DEFS.filter(
      (he) => he.facilityIdentifier === h.facilityIdentifier
    )
    const createdEquipIds: string[] = []
    for (const he of hospitalEquipDefs) {
      const equip = await prisma.hospitalEquipment.create({
        data: {
          hospitalId: hospital.id,
          equipmentTypeId: equipmentTypeMap[he.equipmentCode].id,
          quantity: he.quantity,
          operationalQuantity: he.operationalQuantity,
          status: he.status,
          notes: he.notes,
        },
      })
      createdEquipIds.push(equip.id)
      equipmentCount++
    }

    // Equipment maintenance (one CT scanner under maintenance at Nakuru)
    if (h.facilityIdentifier === "HOSP-104") {
      const nakuruCtEquip = await prisma.hospitalEquipment.findFirst({
        where: {
          hospitalId: hospital.id,
          equipmentTypeId: equipmentTypeMap["CT_SCANNER"].id,
        },
      })
      if (nakuruCtEquip) {
        await prisma.equipmentMaintenance.create({
          data: {
            hospitalEquipmentId: nakuruCtEquip.id,
            equipmentTypeId: equipmentTypeMap["CT_SCANNER"].id,
            startDate: new Date("2026-08-10T08:00:00Z"),
            endDate: new Date("2026-08-15T17:00:00Z"),
            reason: "Scheduled annual calibration and software update",
            notes: "CT scanner taken offline for preventive maintenance",
          },
        })
        maintenanceCount++
      }
    }

    // Hospital staff
    const hospitalStaffDefs = HOSPITAL_STAFF_DEFS.filter(
      (hs) => hs.facilityIdentifier === h.facilityIdentifier
    )
    for (const hs of hospitalStaffDefs) {
      await prisma.hospitalStaff.create({
        data: {
          hospitalId: hospital.id,
          staffTypeId: staffTypeMap[hs.staffCode].id,
          quantity: hs.quantity,
          activeQuantity: hs.activeQuantity,
        },
      })
      staffCount++
    }

    // Operating hours
    const hoursPattern = HOSPITAL_HOURS_PATTERN[h.type] ?? WEEKDAY_HOURS
    for (const hours of hoursPattern) {
      await prisma.hospitalOperatingHours.create({
        data: {
          hospitalId: hospital.id,
          dayOfWeek: hours.dayOfWeek,
          isOpen: hours.isOpen,
          is24Hour: hours.is24Hour,
          openTime: hours.openTime,
          closeTime: hours.closeTime,
          hasEmergency: hours.hasEmergency,
        },
      })
      operatingHoursCount++
    }

    // Service capacity
    const hospitalCapacities = SERVICE_CAPACITY_DEFS.filter(
      (sc) => sc.facilityIdentifier === h.facilityIdentifier
    )
    for (const sc of hospitalCapacities) {
      await prisma.serviceCapacity.create({
        data: {
          hospitalId: hospital.id,
          serviceId: serviceMap[sc.serviceCode].id,
          theoreticalDailyCapacity: sc.theoreticalDailyCapacity,
          operationalDailyCapacity: sc.operationalDailyCapacity,
          weeklyCapacity: sc.weeklyCapacity,
          monthlyCapacity: sc.monthlyCapacity,
          averageProcedureDurationMinutes: sc.averageProcedureDurationMinutes,
          capacityBasis: sc.capacityBasis,
        },
      })
      serviceCapacityCount++
    }

    const hospitalUser = await prisma.user.create({
      data: {
        name: h.userName,
        email: h.userEmail,
        passwordHash,
        role: UserRole.HOSPITAL_USER,
        hospitalId: hospital.id,
      },
    })

    for (const [i, c] of h.claims.entries()) {
      const items = c.items.map((it) => ({
        ...it,
        unitAmountCents: kes(it.unitKes),
        totalAmountCents: kes(it.unitKes) * it.qty,
      }))
      const totalAmountCents = items.reduce(
        (sum, it) => sum + it.totalAmountCents,
        0
      )

      // Create patient record
      const patient = await prisma.patient.create({
        data: {
          externalReference: c.patientRef,
        },
      })
      patientCount++

      // Determine encounter type based on services in the claim
      const hasSurgery = items.some(
        (it) =>
          it.code.startsWith("SURGERY") ||
          it.code === "DELIVERY_CS"
      )
      const hasEmergencyService = items.some(
        (it) => it.code === "EMERGENCY" || it.code === "AMBULANCE"
      )
      const hasICU = items.some((it) => it.code === "ICU")
      const hasInpatientService = items.some(
        (it) => it.code === "DIALYSIS" || it.code === "CHEMOTHERAPY"
      )

      let encounterType: EncounterType = EncounterType.OUTPATIENT
      if (hasSurgery || hasICU || hasInpatientService) {
        encounterType = EncounterType.INPATIENT
      } else if (hasEmergencyService) {
        encounterType = EncounterType.EMERGENCY
      }

      // Create encounter
      const encounter = await prisma.encounter.create({
        data: {
          patientId: patient.id,
          hospitalId: hospital.id,
          encounterDate: new Date(c.submittedAt),
          encounterType,
          diagnosis: c.diagnosis,
          status: c.status === ClaimStatus.DRAFT ? "DRAFT" : "ACTIVE",
          admissionDate: hasICU || hasInpatientService ? new Date(c.submittedAt) : undefined,
        },
      })
      encounterCount++

      const claim = await prisma.claim.create({
        data: {
          reference: `CLM-2026-${h.facilityIdentifier.slice(-3)}-${String(i + 1).padStart(2, "0")}`,
          hospitalId: hospital.id,
          submittedById: hospitalUser.id,
          patientId: patient.id,
          encounterId: encounter.id,
          patientReference: c.patientRef,
          diagnosis: c.diagnosis,
          status: c.status,
          source: ClaimSource.HOSPITAL_PORTAL,
          totalAmountCents,
          submittedAt: new Date(c.submittedAt),
        },
      })
      claimCount++

      for (const it of items) {
        await prisma.claimItem.create({
          data: {
            claimId: claim.id,
            serviceId: serviceMap[it.code].id,
            description: it.description,
            quantity: it.qty,
            unitAmountCents: it.unitAmountCents,
            totalAmountCents: it.totalAmountCents,
          },
        })
        itemCount++

        // Patient service history
        await prisma.patientServiceHistory.create({
          data: {
            patientId: patient.id,
            serviceId: serviceMap[it.code].id,
            encounterId: encounter.id,
            facilityLevelRank: facilityLevelMap[h.facilityLevel].rank,
            claimedAmountCents: it.totalAmountCents,
            quantity: it.qty,
            claimDate: new Date(c.submittedAt),
          },
        })
        serviceHistoryCount++
      }

      await prisma.auditLog.create({
        data: {
          userId: hospitalUser.id,
          action: "CLAIM_SUBMITTED",
          entityType: "Claim",
          entityId: claim.id,
        },
      })
      auditLogCount++

      // ─── Rule evaluation (computed from real data) ────
      const mismatched = items.filter((it) => !h.services.includes(it.code))
      const oversizedQty = items.filter((it) => it.qty > QTY_THRESHOLD)

      const triggers: {
        rule: RuleWithId
        triggered: boolean
        explanation: string
      }[] = [
        {
          rule: ruleMap["R-001"],
          triggered: h.verificationStatus !== VerificationStatus.VERIFIED,
          explanation: `Facility verification status: ${h.verificationStatus}`,
        },
        {
          rule: ruleMap["R-002"],
          triggered: mismatched.length > 0,
          explanation: mismatched.length
            ? `Claimed service(s) not in facility capabilities: ${mismatched.map((m) => m.code).join(", ")}`
            : "All claimed services are within facility capabilities",
        },
        {
          rule: ruleMap["R-004"],
          triggered: totalAmountCents > AMOUNT_THRESHOLD_CENTS,
          explanation: `Claim total is KES ${(totalAmountCents / 100).toLocaleString()} (threshold KES ${(AMOUNT_THRESHOLD_CENTS / 100).toLocaleString()})`,
        },
        {
          rule: ruleMap["R-005"],
          triggered: oversizedQty.length > 0,
          explanation: oversizedQty.length
            ? `Item quantity exceeds ${QTY_THRESHOLD}: ${oversizedQty.map((m) => `${m.code} x${m.qty}`).join(", ")}`
            : "All item quantities within normal range",
        },
      ]

      let ruleScore = 0
      for (const t of triggers) {
        await prisma.claimRuleEvaluation.create({
          data: {
            claimId: claim.id,
            complianceRuleId: t.rule.id,
            triggered: t.triggered,
            scoreContribution: t.triggered ? t.rule.scoreContribution : 0,
            explanation: t.explanation,
          },
        })
        ruleEvalCount++

        if (t.triggered) {
          ruleScore += t.rule.scoreContribution
          await prisma.finding.create({
            data: {
              claimId: claim.id,
              complianceRuleId: t.rule.id,
              type: t.rule.name.toUpperCase().replace(/\s+/g, "_"),
              severity: t.rule.severity,
              source: FindingSource.RULE,
              title: t.rule.name,
              explanation: t.explanation,
              scoreContribution: t.rule.scoreContribution,
            },
          })
          findingCount++
        }
      }

      // ─── AI analysis (only where configured) ──────────
      let aiScoreImpact = 0
      let aiAnalysisId: string | undefined
      if (c.ai) {
        const analysis = await prisma.aiAnalysis.create({
          data: {
            claimId: claim.id,
            provider: c.ai.provider,
            model: c.ai.model,
            status: AiAnalysisStatus.COMPLETED,
            structuredResponse: {
              overallAssessment: c.ai.overallAssessment,
              confidence: c.ai.confidence,
              summary: c.ai.summary,
            },
            confidence: c.ai.confidence,
            startedAt: new Date(c.submittedAt),
            completedAt: new Date(new Date(c.submittedAt).getTime() + 60_000),
          },
        })
        aiAnalysisCount++
        aiAnalysisId = analysis.id

        await prisma.aiFinding.create({
          data: {
            aiAnalysisId: analysis.id,
            claimId: claim.id,
            type: c.ai.findingType,
            severity: c.ai.findingSeverity,
            confidence: c.ai.confidence,
            explanation: c.ai.findingExplanation,
          },
        })
        aiFindingCount++
        aiScoreImpact = c.ai.scoreImpact
      }

      // ─── Risk score + contributors ─────────────────────
      const totalScore = ruleScore + aiScoreImpact
      const riskScore = await prisma.riskScore.create({
        data: {
          claimId: claim.id,
          score: totalScore,
          level: riskLevelFromScore(totalScore),
        },
      })
      riskScoreCount++

      const contributors = triggers
        .filter((t) => t.triggered)
        .map((t) => ({
          riskScoreId: riskScore.id,
          type: "RULE",
          description: t.rule.name,
          scoreImpact: t.rule.scoreContribution,
        }))
      if (c.ai) {
        contributors.push({
          riskScoreId: riskScore.id,
          type: "AI",
          description: c.ai.summary,
          scoreImpact: aiScoreImpact,
        })
      }
      if (contributors.length) {
        await prisma.riskContributor.createMany({ data: contributors })
      }

      // ─── Review ────────────────────────────────────────
      if (c.review) {
        const review = await prisma.review.create({
          data: {
            claimId: claim.id,
            reviewerId: officers[c.review.officer].id,
            status: c.review.status,
            outcome: c.review.outcome as ReviewOutcome,
            notes: c.review.notes,
            startedAt: new Date(c.submittedAt),
            completedAt:
              c.review.status === ReviewStatus.COMPLETED
                ? new Date()
                : undefined,
          },
        })
        reviewCount++

        await prisma.reviewAction.create({
          data: {
            reviewId: review.id,
            action:
              c.review.status === ReviewStatus.COMPLETED
                ? "OUTCOME_RECORDED"
                : "REVIEW_STARTED",
            details: { notes: c.review.notes ?? "Review initiated" },
          },
        })

        await prisma.auditLog.create({
          data: {
            userId: officers[c.review.officer].id,
            action:
              c.review.status === ReviewStatus.COMPLETED
                ? "REVIEW_COMPLETED"
                : "REVIEW_STARTED",
            entityType: "Review",
            entityId: review.id,
          },
        })
        auditLogCount++
      }

      // ─── Alert (auto for score >= 50, unless overridden) ─
      if (totalScore >= 50 || c.alertStatus) {
        const status = c.alertStatus ?? (totalScore >= 75 ? "OPEN" : "OPEN")
        await prisma.alert.create({
          data: {
            type: aiScoreImpact
              ? "AI_REVIEW_REQUIRED"
              : mismatched.length
                ? "SERVICE_MISMATCH"
                : "HIGH_RISK_CLAIM",
            severity: totalScore >= 75 ? "CRITICAL" : "HIGH",
            status,
            title: `High risk claim: ${claim.reference}`,
            description: `Claim ${claim.reference} from ${h.name} has a risk score of ${totalScore}.`,
            claimId: claim.id,
            hospitalId: hospital.id,
            riskScoreId: riskScore.id,
            source: c.ai ? "AI" : "RULE",
            resolvedAt: status === "RESOLVED" ? new Date() : undefined,
            resolvedById:
              status === "RESOLVED"
                ? officers[c.review?.officer ?? "sarah"].id
                : undefined,
            metadata: {
              riskScore: totalScore,
              riskLevel: riskLevelFromScore(totalScore),
            },
          },
        })
        alertCount++

        await prisma.auditLog.create({
          data: {
            userId: shaOfficer1.id,
            action: "CLAIM_FLAGGED",
            entityType: "Claim",
            entityId: claim.id,
          },
        })
        auditLogCount++
      }
    }
  }

  // ─── Draft claim (Nairobi General) ───────────────────
  const draftHospital = await prisma.hospital.findUniqueOrThrow({
    where: { facilityIdentifier: DRAFT_CLAIM.hospitalFacilityIdentifier },
  })
  const draftUser = await prisma.user.findFirstOrThrow({
    where: { hospitalId: draftHospital.id },
  })

  // Draft patient
  const draftPatient = await prisma.patient.create({
    data: {
      externalReference: DRAFT_CLAIM.patientRef,
    },
  })
  patientCount++

  const draftClaim = await prisma.claim.create({
    data: {
      reference: "CLM-2026-DRAFT-01",
      hospitalId: draftHospital.id,
      submittedById: draftUser.id,
      patientId: draftPatient.id,
      patientReference: DRAFT_CLAIM.patientRef,
      diagnosis: DRAFT_CLAIM.diagnosis,
      status: ClaimStatus.DRAFT,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 0,
    },
  })
  claimCount++
  for (const it of DRAFT_CLAIM.items) {
    await prisma.claimItem.create({
      data: {
        claimId: draftClaim.id,
        serviceId: serviceMap[it.code].id,
        description: it.description,
        quantity: it.qty,
        unitAmountCents: kes(it.unitKes),
        totalAmountCents: kes(it.unitKes) * it.qty,
      },
    })
    itemCount++
  }

  console.log("Seed completed successfully!")
  console.log(`  ${facilityLevels.length} facility levels`)
  console.log(`  ${equipmentTypes.length} equipment types`)
  console.log(`  ${staffTypes.length} staff types`)
  console.log(`  ${services.length} services`)
  console.log(`  ${rules.length} compliance rules`)
  console.log(`  ${serviceRequirements.length} service requirements`)
  console.log(`  ${serviceEquipmentLinks.length} service equipment links`)
  console.log(`  ${serviceStaffLinks.length} service staff links`)
  console.log(`  ${facilityLevelCapabilities.length} facility level capabilities`)
  console.log(`  ${serviceTariffs.length} service tariffs`)
  console.log(`  ${billingPolicies.length} billing policies`)
  console.log(`  ${HOSPITAL_DEFS.length} hospitals`)
  console.log(`  ${HOSPITAL_DEFS.length + 3} users`)
  console.log(`  ${claimCount} claims`)
  console.log(`  ${itemCount} claim items`)
  console.log(`  ${ruleEvalCount} rule evaluations`)
  console.log(`  ${findingCount} deterministic findings`)
  console.log(
    `  ${aiAnalysisCount} AI analyses / ${aiFindingCount} AI findings`
  )
  console.log(`  ${riskScoreCount} risk scores`)
  console.log(`  ${reviewCount} reviews`)
  console.log(`  ${alertCount} alerts`)
  console.log(`  ${patientCount} patients`)
  console.log(`  ${encounterCount} encounters`)
  console.log(`  ${serviceHistoryCount} patient service histories`)
  console.log(`  ${equipmentCount} hospital equipment entries`)
  console.log(`  ${staffCount} hospital staff entries`)
  console.log(`  ${operatingHoursCount} operating hours entries`)
  console.log(`  ${hospitalCapabilityCount} hospital service capabilities`)
  console.log(`  ${serviceCapacityCount} service capacity entries`)
  console.log(`  ${maintenanceCount} equipment maintenance entries`)
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
