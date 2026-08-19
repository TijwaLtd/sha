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
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    code: "CONSULTATION",
    name: "General Consultation",
    description: "Outpatient consultation with physician",
    category: "OUTPATIENT",
  },
  {
    code: "SPECIALIST_CONSULT",
    name: "Specialist Consultation",
    description: "Consultation with a specialist physician",
    category: "OUTPATIENT",
  },
  {
    code: "MALARIA_TEST",
    name: "Malaria Test",
    description: "Rapid diagnostic test for malaria",
    category: "LABORATORY",
  },
  {
    code: "CBC",
    name: "Complete Blood Count",
    description: "Full blood count laboratory test",
    category: "LABORATORY",
  },
  {
    code: "URINALYSIS",
    name: "Urinalysis",
    description: "Urine laboratory analysis",
    category: "LABORATORY",
  },
  {
    code: "BLOOD_CHEM",
    name: "Blood Chemistry Panel",
    description: "Metabolic/electrolyte blood panel",
    category: "LABORATORY",
  },
  {
    code: "HIV_TEST",
    name: "HIV Testing & Counselling",
    description: "HIV rapid test with counselling",
    category: "LABORATORY",
  },
  {
    code: "TB_SCREEN",
    name: "TB Screening (GeneXpert)",
    description: "Molecular TB screening test",
    category: "LABORATORY",
  },
  {
    code: "BLOOD_GROUP",
    name: "Blood Grouping & Crossmatch",
    description: "Blood typing and crossmatch",
    category: "LABORATORY",
  },
  {
    code: "X_RAY",
    name: "X-Ray",
    description: "Radiographic imaging",
    category: "RADIOLOGY",
  },
  {
    code: "ULTRASOUND",
    name: "Ultrasound",
    description: "Diagnostic ultrasound imaging",
    category: "RADIOLOGY",
  },
  {
    code: "CT_SCAN",
    name: "CT Scan",
    description: "Computed tomography imaging",
    category: "RADIOLOGY",
  },
  {
    code: "MRI",
    name: "MRI Scan",
    description: "Magnetic Resonance Imaging",
    category: "RADIOLOGY",
  },
  {
    code: "SURGERY_MINOR",
    name: "Minor Surgery",
    description: "Minor surgical procedure",
    category: "SURGERY",
  },
  {
    code: "SURGERY_MAJOR",
    name: "Major Surgery",
    description: "Major surgical procedure",
    category: "SURGERY",
  },
  {
    code: "ORTHO_SURGERY",
    name: "Orthopedic Surgery",
    description: "Bone/joint surgical procedure",
    category: "SURGERY",
  },
  {
    code: "ANC",
    name: "Antenatal Care",
    description: "Antenatal check-up and monitoring",
    category: "MATERNITY",
  },
  {
    code: "DELIVERY_NORMAL",
    name: "Normal Delivery",
    description: "Vaginal delivery care",
    category: "MATERNITY",
  },
  {
    code: "DELIVERY_CS",
    name: "Caesarean Section",
    description: "Surgical delivery",
    category: "MATERNITY",
  },
  {
    code: "POSTNATAL",
    name: "Postnatal Care",
    description: "Post-delivery follow-up care",
    category: "MATERNITY",
  },
  {
    code: "DENTAL",
    name: "Dental Services",
    description: "Dental examination and treatment",
    category: "DENTAL",
  },
  {
    code: "PHARMACY",
    name: "Pharmacy",
    description: "Dispensing of medication",
    category: "PHARMACY",
  },
  {
    code: "EMERGENCY",
    name: "Emergency Services",
    description: "Emergency medical care",
    category: "EMERGENCY",
  },
  {
    code: "AMBULANCE",
    name: "Ambulance Services",
    description: "Emergency patient transport",
    category: "EMERGENCY",
  },
  {
    code: "ICU",
    name: "Intensive Care Unit",
    description: "Critical care admission, per day",
    category: "CRITICAL_CARE",
  },
  {
    code: "DIALYSIS",
    name: "Renal Dialysis",
    description: "Dialysis session",
    category: "CRITICAL_CARE",
  },
  {
    code: "CHEMOTHERAPY",
    name: "Chemotherapy",
    description: "Chemotherapy session",
    category: "ONCOLOGY",
  },
  {
    code: "PHYSIOTHERAPY",
    name: "Physiotherapy",
    description: "Physiotherapy session",
    category: "PHYSIOTHERAPY",
  },
  {
    code: "MENTAL_HEALTH",
    name: "Mental Health Services",
    description: "Mental health outpatient session",
    category: "MENTAL_HEALTH",
  },
  {
    code: "FAMILY_PLANNING",
    name: "Family Planning",
    description: "Family planning services",
    category: "PREVENTIVE",
  },
  {
    code: "IMMUNIZATION",
    name: "Immunization",
    description: "Vaccination services",
    category: "PREVENTIVE",
  },
  {
    code: "OPTICAL",
    name: "Eye Clinic",
    description: "Optical/eye clinic services",
    category: "OPTICAL",
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
  await prisma.claim.deleteMany()
  await prisma.hospitalService.deleteMany()
  await prisma.complianceRule.deleteMany()
  await prisma.service.deleteMany()
  await prisma.user.deleteMany()
  await prisma.hospital.deleteMany()

  // ─── Services ────────────────────────────────────────
  const services = await Promise.all(
    SERVICE_DEFS.map((s) => prisma.service.create({ data: s }))
  )
  const serviceMap = Object.fromEntries(services.map((s) => [s.code, s]))

  // ─── Compliance Rules ────────────────────────────────
  const rules = await Promise.all(
    RULE_DEFS.map((r) => prisma.complianceRule.create({ data: r }))
  )
  const ruleMap = Object.fromEntries(rules.map((r) => [r.code, r])) as Record<string, RuleWithId>

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
      },
    })

    for (const code of h.services) {
      await prisma.hospitalService.create({
        data: { hospitalId: hospital.id, serviceId: serviceMap[code].id },
      })
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

      const claim = await prisma.claim.create({
        data: {
          reference: `CLM-2026-${h.facilityIdentifier.slice(-3)}-${String(i + 1).padStart(2, "0")}`,
          hospitalId: hospital.id,
          submittedById: hospitalUser.id,
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
  const draftClaim = await prisma.claim.create({
    data: {
      reference: "CLM-2026-DRAFT-01",
      hospitalId: draftHospital.id,
      submittedById: draftUser.id,
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
  console.log(`  ${services.length} services`)
  console.log(`  ${rules.length} compliance rules`)
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
