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
  AiAnalysisStatus,
} from "../app/generated/prisma/enums"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database...")

  // Clean existing data
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
  const services = await Promise.all([
    prisma.service.create({
      data: {
        code: "CONSULTATION",
        name: "General Consultation",
        description: "Outpatient consultation with physician",
        category: "OUTPATIENT",
      },
    }),
    prisma.service.create({
      data: {
        code: "MALARIA_TEST",
        name: "Malaria Test",
        description: "Rapid diagnostic test for malaria",
        category: "LABORATORY",
      },
    }),
    prisma.service.create({
      data: {
        code: "CBC",
        name: "Complete Blood Count",
        description: "Full blood count laboratory test",
        category: "LABORATORY",
      },
    }),
    prisma.service.create({
      data: {
        code: "MRI",
        name: "MRI Scan",
        description: "Magnetic Resonance Imaging",
        category: "RADIOLOGY",
      },
    }),
    prisma.service.create({
      data: {
        code: "X_RAY",
        name: "X-Ray",
        description: "Radiographic imaging",
        category: "RADIOLOGY",
      },
    }),
    prisma.service.create({
      data: {
        code: "SURGERY",
        name: "Surgery",
        description: "Surgical procedure",
        category: "SURGERY",
      },
    }),
    prisma.service.create({
      data: {
        code: "MATERNITY",
        name: "Maternity Services",
        description: "Antenatal and delivery care",
        category: "MATERNITY",
      },
    }),
    prisma.service.create({
      data: {
        code: "DENTAL",
        name: "Dental Services",
        description: "Dental examination and treatment",
        category: "DENTAL",
      },
    }),
    prisma.service.create({
      data: {
        code: "PHARMACY",
        name: "Pharmacy",
        description: "Dispensing of medication",
        category: "PHARMACY",
      },
    }),
    prisma.service.create({
      data: {
        code: "EMERGENCY",
        name: "Emergency Services",
        description: "Emergency medical care",
        category: "EMERGENCY",
      },
    }),
    prisma.service.create({
      data: {
        code: "ULTRASOUND",
        name: "Ultrasound",
        description: "Diagnostic ultrasound imaging",
        category: "RADIOLOGY",
      },
    }),
    prisma.service.create({
      data: {
        code: "ORTHOPEDICS",
        name: "Orthopedics",
        description: "Bone and joint treatment",
        category: "SPECIALIST",
      },
    }),
  ])

  const serviceMap = Object.fromEntries(services.map((s) => [s.code, s]))

  // ─── Compliance Rules ────────────────────────────────
  const rules = await Promise.all([
    prisma.complianceRule.create({
      data: {
        code: "R-001",
        name: "Facility Not Verified",
        description: "Claim submitted by unverified facility",
        category: "FACILITY",
        severity: FindingSeverity.HIGH,
        scoreContribution: 25,
      },
    }),
    prisma.complianceRule.create({
      data: {
        code: "R-002",
        name: "Facility Service Mismatch",
        description: "Claimed service not in facility capabilities",
        category: "FACILITY",
        severity: FindingSeverity.HIGH,
        scoreContribution: 20,
      },
    }),
    prisma.complianceRule.create({
      data: {
        code: "R-003",
        name: "Duplicate Claim",
        description: "Similar claim already submitted",
        category: "CLAIM",
        severity: FindingSeverity.CRITICAL,
        scoreContribution: 30,
      },
    }),
    prisma.complianceRule.create({
      data: {
        code: "R-004",
        name: "Unusual Claim Amount",
        description: "Claim amount significantly above average",
        category: "AMOUNT",
        severity: FindingSeverity.MEDIUM,
        scoreContribution: 15,
      },
    }),
    prisma.complianceRule.create({
      data: {
        code: "R-005",
        name: "Unusual Quantity",
        description: "Service quantity outside normal range",
        category: "AMOUNT",
        severity: FindingSeverity.MEDIUM,
        scoreContribution: 10,
      },
    }),
    prisma.complianceRule.create({
      data: {
        code: "R-006",
        name: "Diagnosis Mismatch",
        description: "Service does not match claimed diagnosis",
        category: "CLINICAL",
        severity: FindingSeverity.HIGH,
        scoreContribution: 20,
      },
    }),
  ])

  const ruleMap = Object.fromEntries(rules.map((r) => [r.code, r]))

  // ─── Hospitals ───────────────────────────────────────
  const hospitalA = await prisma.hospital.create({
    data: {
      facilityIdentifier: "HOSP-001",
      name: "Nairobi General Hospital",
      type: "GENERAL_HOSPITAL",
      status: HospitalStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
      location: { county: "Nairobi", address: "Kenyatta Avenue" },
    },
  })

  const hospitalB = await prisma.hospital.create({
    data: {
      facilityIdentifier: "HOSP-002",
      name: "Coast Medical Centre",
      type: "MEDICAL_CENTER",
      status: HospitalStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
      location: { county: "Mombasa", address: "Moi Avenue" },
    },
  })

  const hospitalC = await prisma.hospital.create({
    data: {
      facilityIdentifier: "HOSP-003",
      name: "Rift Valley Clinic",
      type: "CLINIC",
      status: HospitalStatus.ACTIVE,
      verificationStatus: VerificationStatus.UNVERIFIED,
      location: { county: "Nakuru", address: "Kenyatta Road" },
    },
  })

  const hospitalD = await prisma.hospital.create({
    data: {
      facilityIdentifier: "HOSP-004",
      name: "Western Province Hospital",
      type: "GENERAL_HOSPITAL",
      status: HospitalStatus.ACTIVE,
      verificationStatus: VerificationStatus.VERIFIED,
      location: { county: "Kisumu", address: "Oginga Odinga Street" },
    },
  })

  const hospitalE = await prisma.hospital.create({
    data: {
      facilityIdentifier: "HOSP-005",
      name: "Highland Specialized Hospital",
      type: "SPECIALIST_HOSPITAL",
      status: HospitalStatus.SUSPENDED,
      verificationStatus: VerificationStatus.REJECTED,
      location: { county: "Nyeri", address: "Kenyatta Road" },
    },
  })

  // ─── Hospital Services ───────────────────────────────
  await Promise.all([
    // Hospital A: Full-service hospital
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.CONSULTATION.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.MALARIA_TEST.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.CBC.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.X_RAY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.SURGERY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.MATERNITY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.PHARMACY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalA.id, serviceId: serviceMap.EMERGENCY.id },
    }),

    // Hospital B: Mid-size facility
    prisma.hospitalService.create({
      data: { hospitalId: hospitalB.id, serviceId: serviceMap.CONSULTATION.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalB.id, serviceId: serviceMap.MALARIA_TEST.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalB.id, serviceId: serviceMap.X_RAY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalB.id, serviceId: serviceMap.PHARMACY.id },
    }),

    // Hospital C: Small clinic - limited services
    prisma.hospitalService.create({
      data: { hospitalId: hospitalC.id, serviceId: serviceMap.CONSULTATION.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalC.id, serviceId: serviceMap.PHARMACY.id },
    }),

    // Hospital D: Medium hospital
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.CONSULTATION.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.CBC.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.X_RAY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.ULTRASOUND.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.PHARMACY.id },
    }),
    prisma.hospitalService.create({
      data: { hospitalId: hospitalD.id, serviceId: serviceMap.EMERGENCY.id },
    }),

    // Hospital E: No services (suspended/rejected)
  ])

  // ─── Users ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password", 10)

  const hospitalUserA = await prisma.user.create({
    data: {
      name: "James Mwangi",
      email: "james@nairobigen.co.ke",
      passwordHash,
      role: UserRole.HOSPITAL_USER,
      hospitalId: hospitalA.id,
    },
  })

  const hospitalUserB = await prisma.user.create({
    data: {
      name: "Amina Hassan",
      email: "amina@coastmedical.co.ke",
      passwordHash,
      role: UserRole.HOSPITAL_USER,
      hospitalId: hospitalB.id,
    },
  })

  const hospitalUserC = await prisma.user.create({
    data: {
      name: "Peter Kiprop",
      email: "peter@riftvalley.co.ke",
      passwordHash,
      role: UserRole.HOSPITAL_USER,
      hospitalId: hospitalC.id,
    },
  })

  const hospitalUserD = await prisma.user.create({
    data: {
      name: "Grace Otieno",
      email: "grace@westernprov.co.ke",
      passwordHash,
      role: UserRole.HOSPITAL_USER,
      hospitalId: hospitalD.id,
    },
  })

  const hospitalUserE = await prisma.user.create({
    data: {
      name: "David Mutua",
      email: "david@highland.co.ke",
      passwordHash,
      role: UserRole.HOSPITAL_USER,
      hospitalId: hospitalE.id,
    },
  })

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

  // ─── Claims ──────────────────────────────────────────

  // Hospital A: Clean claims (verified, normal amounts)
  const claimA1 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-001",
      hospitalId: hospitalA.id,
      submittedById: hospitalUserA.id,
      patientReference: "PAT-SYN-001",
      diagnosis: "Upper respiratory tract infection",
      status: ClaimStatus.RECEIVED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 450000, // KES 4,500
      submittedAt: new Date("2026-08-01T09:00:00Z"),
    },
  })

  const claimA2 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-002",
      hospitalId: hospitalA.id,
      submittedById: hospitalUserA.id,
      patientReference: "PAT-SYN-002",
      diagnosis: "Malaria - uncomplicated",
      status: ClaimStatus.ASSESSED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 280000, // KES 2,800
      submittedAt: new Date("2026-08-03T10:30:00Z"),
    },
  })

  const claimA3 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-003",
      hospitalId: hospitalA.id,
      submittedById: hospitalUserA.id,
      patientReference: "PAT-SYN-003",
      diagnosis: "Normal delivery - uncomplicated",
      status: ClaimStatus.CLEARED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 3500000, // KES 35,000
      submittedAt: new Date("2026-08-05T14:00:00Z"),
    },
  })

  // Hospital B: Some flagged claims
  const claimB1 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-004",
      hospitalId: hospitalB.id,
      submittedById: hospitalUserB.id,
      patientReference: "PAT-SYN-004",
      diagnosis: "Fracture - left radius",
      status: ClaimStatus.FLAGGED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 850000, // KES 8,500
      submittedAt: new Date("2026-08-02T11:00:00Z"),
    },
  })

  const claimB2 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-005",
      hospitalId: hospitalB.id,
      submittedById: hospitalUserB.id,
      patientReference: "PAT-SYN-005",
      diagnosis: "Severe malaria with complications",
      status: ClaimStatus.UNDER_REVIEW,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 1250000, // KES 12,500
      submittedAt: new Date("2026-08-04T08:15:00Z"),
    },
  })

  // Hospital C: Unverified hospital - claims should trigger R-001
  const claimC1 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-006",
      hospitalId: hospitalC.id,
      submittedById: hospitalUserC.id,
      patientReference: "PAT-SYN-006",
      diagnosis: "Chronic back pain",
      status: ClaimStatus.RECEIVED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 180000, // KES 1,800
      submittedAt: new Date("2026-08-06T09:45:00Z"),
    },
  })

  const claimC2 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-007",
      hospitalId: hospitalC.id,
      submittedById: hospitalUserC.id,
      patientReference: "PAT-SYN-007",
      diagnosis: "MRI scan - lumbar spine",
      status: ClaimStatus.VALIDATING,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 1500000, // KES 15,000 - MRI but hospital doesn't have radiology
      submittedAt: new Date("2026-08-07T10:00:00Z"),
    },
  })

  // Hospital D: Mixed claims
  const claimD1 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-008",
      hospitalId: hospitalD.id,
      submittedById: hospitalUserD.id,
      patientReference: "PAT-SYN-008",
      diagnosis: "Prenatal care - third trimester",
      status: ClaimStatus.ASSESSED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 650000, // KES 6,500
      submittedAt: new Date("2026-08-01T13:00:00Z"),
    },
  })

  const claimD2 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-009",
      hospitalId: hospitalD.id,
      submittedById: hospitalUserD.id,
      patientReference: "PAT-SYN-009",
      diagnosis: "Appendicitis - surgical intervention",
      status: ClaimStatus.FLAGGED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 4200000, // KES 42,000 - unusually high
      submittedAt: new Date("2026-08-08T07:30:00Z"),
    },
  })

  // Hospital E: Suspended hospital - claims
  const claimE1 = await prisma.claim.create({
    data: {
      reference: "CLM-2026-010",
      hospitalId: hospitalE.id,
      submittedById: hospitalUserE.id,
      patientReference: "PAT-SYN-010",
      diagnosis: "General checkup",
      status: ClaimStatus.RECEIVED,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 95000, // KES 950
      submittedAt: new Date("2026-08-09T11:20:00Z"),
    },
  })

  // Draft claim
  const claimDraft = await prisma.claim.create({
    data: {
      reference: "CLM-2026-011",
      hospitalId: hospitalA.id,
      submittedById: hospitalUserA.id,
      patientReference: "PAT-SYN-011",
      diagnosis: "Pending diagnosis",
      status: ClaimStatus.DRAFT,
      source: ClaimSource.HOSPITAL_PORTAL,
      totalAmountCents: 0,
    },
  })

  // ─── Claim Items ─────────────────────────────────────
  await Promise.all([
    // Claim A1 items
    prisma.claimItem.create({
      data: {
        claimId: claimA1.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Initial consultation",
        quantity: 1,
        unitAmountCents: 150000,
        totalAmountCents: 150000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimA1.id,
        serviceId: serviceMap.MALARIA_TEST.id,
        description: "Malaria RDT",
        quantity: 2,
        unitAmountCents: 50000,
        totalAmountCents: 100000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimA1.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Antibiotics - Amoxicillin",
        quantity: 1,
        unitAmountCents: 200000,
        totalAmountCents: 200000,
      },
    }),

    // Claim A2 items
    prisma.claimItem.create({
      data: {
        claimId: claimA2.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Follow-up consultation",
        quantity: 1,
        unitAmountCents: 150000,
        totalAmountCents: 150000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimA2.id,
        serviceId: serviceMap.MALARIA_TEST.id,
        description: "Malaria RDT",
        quantity: 1,
        unitAmountCents: 50000,
        totalAmountCents: 50000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimA2.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "ACT medication",
        quantity: 1,
        unitAmountCents: 80000,
        totalAmountCents: 80000,
      },
    }),

    // Claim A3 items
    prisma.claimItem.create({
      data: {
        claimId: claimA3.id,
        serviceId: serviceMap.MATERNITY.id,
        description: "Normal delivery - uncomplicated",
        quantity: 1,
        unitAmountCents: 3000000,
        totalAmountCents: 3000000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimA3.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Post-delivery medication",
        quantity: 1,
        unitAmountCents: 500000,
        totalAmountCents: 500000,
      },
    }),

    // Claim B1 items - MRI at facility without radiology
    prisma.claimItem.create({
      data: {
        claimId: claimB1.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Orthopedic consultation",
        quantity: 1,
        unitAmountCents: 200000,
        totalAmountCents: 200000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimB1.id,
        serviceId: serviceMap.X_RAY.id,
        description: "X-ray left forearm",
        quantity: 2,
        unitAmountCents: 150000,
        totalAmountCents: 300000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimB1.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Pain medication and cast materials",
        quantity: 1,
        unitAmountCents: 350000,
        totalAmountCents: 350000,
      },
    }),

    // Claim B2 items - unusually high amounts
    prisma.claimItem.create({
      data: {
        claimId: claimB2.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Emergency consultation",
        quantity: 3,
        unitAmountCents: 200000,
        totalAmountCents: 600000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimB2.id,
        serviceId: serviceMap.MALARIA_TEST.id,
        description: "Malaria test",
        quantity: 5,
        unitAmountCents: 50000,
        totalAmountCents: 250000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimB2.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "IV medication",
        quantity: 10,
        unitAmountCents: 40000,
        totalAmountCents: 400000,
      },
    }),

    // Claim C1 items
    prisma.claimItem.create({
      data: {
        claimId: claimC1.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "General consultation",
        quantity: 1,
        unitAmountCents: 100000,
        totalAmountCents: 100000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimC1.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Pain relief medication",
        quantity: 1,
        unitAmountCents: 80000,
        totalAmountCents: 80000,
      },
    }),

    // Claim C2 items - MRI at clinic without radiology
    prisma.claimItem.create({
      data: {
        claimId: claimC2.id,
        serviceId: serviceMap.MRI.id,
        description: "MRI lumbar spine",
        quantity: 1,
        unitAmountCents: 1500000,
        totalAmountCents: 1500000,
      },
    }),

    // Claim D1 items
    prisma.claimItem.create({
      data: {
        claimId: claimD1.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Prenatal consultation",
        quantity: 3,
        unitAmountCents: 100000,
        totalAmountCents: 300000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimD1.id,
        serviceId: serviceMap.ULTRASOUND.id,
        description: "Ultrasound scan",
        quantity: 1,
        unitAmountCents: 200000,
        totalAmountCents: 200000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimD1.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Prenatal supplements",
        quantity: 1,
        unitAmountCents: 150000,
        totalAmountCents: 150000,
      },
    }),

    // Claim D2 items - unusually high amount
    prisma.claimItem.create({
      data: {
        claimId: claimD2.id,
        serviceId: serviceMap.SURGERY.id,
        description: "Appendectomy - laparoscopic",
        quantity: 1,
        unitAmountCents: 3500000,
        totalAmountCents: 3500000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimD2.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Pre-surgical consultation",
        quantity: 1,
        unitAmountCents: 200000,
        totalAmountCents: 200000,
      },
    }),
    prisma.claimItem.create({
      data: {
        claimId: claimD2.id,
        serviceId: serviceMap.PHARMACY.id,
        description: "Post-surgical medication",
        quantity: 1,
        unitAmountCents: 500000,
        totalAmountCents: 500000,
      },
    }),

    // Claim E1 items
    prisma.claimItem.create({
      data: {
        claimId: claimE1.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "General checkup",
        quantity: 1,
        unitAmountCents: 95000,
        totalAmountCents: 95000,
      },
    }),

    // Draft claim - partial items
    prisma.claimItem.create({
      data: {
        claimId: claimDraft.id,
        serviceId: serviceMap.CONSULTATION.id,
        description: "Consultation (draft)",
        quantity: 1,
        unitAmountCents: 150000,
        totalAmountCents: 150000,
      },
    }),
  ])

  // ─── Rule Evaluations ────────────────────────────────
  await Promise.all([
    // Claim B1 - service mismatch (MRI at facility without radiology)
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimB1.id,
        complianceRuleId: ruleMap["R-002"].id,
        triggered: true,
        scoreContribution: 20,
        explanation: "Facility does not have MRI capability",
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimB1.id,
        complianceRuleId: ruleMap["R-004"].id,
        triggered: true,
        scoreContribution: 15,
        explanation: "Claim amount above average for fracture treatment",
      },
    }),

    // Claim B2 - unusual quantities
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimB2.id,
        complianceRuleId: ruleMap["R-005"].id,
        triggered: true,
        scoreContribution: 10,
        explanation: "Multiple emergency consultations in single claim",
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimB2.id,
        complianceRuleId: ruleMap["R-004"].id,
        triggered: true,
        scoreContribution: 15,
        explanation: "High total amount for malaria treatment",
      },
    }),

    // Claim C1 - unverified facility
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimC1.id,
        complianceRuleId: ruleMap["R-001"].id,
        triggered: true,
        scoreContribution: 25,
        explanation: "Facility verification status: UNVERIFIED",
      },
    }),

    // Claim C2 - unverified facility + service mismatch
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimC2.id,
        complianceRuleId: ruleMap["R-001"].id,
        triggered: true,
        scoreContribution: 25,
        explanation: "Facility verification status: UNVERIFIED",
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimC2.id,
        complianceRuleId: ruleMap["R-002"].id,
        triggered: true,
        scoreContribution: 20,
        explanation: "MRI service not in facility capabilities",
      },
    }),

    // Claim D2 - unusually high amount
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimD2.id,
        complianceRuleId: ruleMap["R-004"].id,
        triggered: true,
        scoreContribution: 15,
        explanation: "Surgical claim amount significantly above average",
      },
    }),

    // Clean claims - no triggered rules
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimA1.id,
        complianceRuleId: ruleMap["R-001"].id,
        triggered: false,
        scoreContribution: 0,
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimA1.id,
        complianceRuleId: ruleMap["R-002"].id,
        triggered: false,
        scoreContribution: 0,
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimA2.id,
        complianceRuleId: ruleMap["R-001"].id,
        triggered: false,
        scoreContribution: 0,
      },
    }),
    prisma.claimRuleEvaluation.create({
      data: {
        claimId: claimA3.id,
        complianceRuleId: ruleMap["R-001"].id,
        triggered: false,
        scoreContribution: 0,
      },
    }),
  ])

  // ─── AI Analyses ─────────────────────────────────────
  const aiAnalysisB1 = await prisma.aiAnalysis.create({
    data: {
      claimId: claimB1.id,
      provider: "groq",
      model: "llama-3.1-70b-versatile",
      status: AiAnalysisStatus.COMPLETED,
      structuredResponse: {
        overallAssessment: "HIGH_RISK",
        confidence: 0.85,
        summary: "Claim contains services potentially outside facility scope",
      },
      confidence: 0.85,
      startedAt: new Date("2026-08-02T11:30:00Z"),
      completedAt: new Date("2026-08-02T11:30:45Z"),
    },
  })

  const aiAnalysisB2 = await prisma.aiAnalysis.create({
    data: {
      claimId: claimB2.id,
      provider: "groq",
      model: "llama-3.1-70b-versatile",
      status: AiAnalysisStatus.COMPLETED,
      structuredResponse: {
        overallAssessment: "MODERATE_RISK",
        confidence: 0.72,
        summary:
          "Quantities appear elevated for standard malaria treatment protocol",
      },
      confidence: 0.72,
      startedAt: new Date("2026-08-04T08:45:00Z"),
      completedAt: new Date("2026-08-04T08:46:10Z"),
    },
  })

  const aiAnalysisD2 = await prisma.aiAnalysis.create({
    data: {
      claimId: claimD2.id,
      provider: "openrouter",
      model: "anthropic/claude-3-haiku",
      status: AiAnalysisStatus.COMPLETED,
      structuredResponse: {
        overallAssessment: "HIGH_RISK",
        confidence: 0.88,
        summary:
          "Surgical claim amount appears significantly above regional average",
      },
      confidence: 0.88,
      startedAt: new Date("2026-08-08T08:00:00Z"),
      completedAt: new Date("2026-08-08T08:01:20Z"),
    },
  })

  // ─── AI Findings ─────────────────────────────────────
  await Promise.all([
    prisma.aiFinding.create({
      data: {
        aiAnalysisId: aiAnalysisB1.id,
        claimId: claimB1.id,
        type: "SERVICE_RELEVANCE",
        severity: FindingSeverity.HIGH,
        confidence: 0.85,
        explanation:
          "X-ray services claimed but facility verification shows no radiology department",
      },
    }),
    prisma.aiFinding.create({
      data: {
        aiAnalysisId: aiAnalysisB2.id,
        claimId: claimB2.id,
        type: "QUANTITY_ANOMALY",
        severity: FindingSeverity.MEDIUM,
        confidence: 0.72,
        explanation:
          "Multiple emergency consultations (3) and malaria tests (5) in single visit is unusual",
      },
    }),
    prisma.aiFinding.create({
      data: {
        aiAnalysisId: aiAnalysisD2.id,
        claimId: claimD2.id,
        type: "AMOUNT_ANOMALY",
        severity: FindingSeverity.HIGH,
        confidence: 0.88,
        explanation:
          "Surgical claim at KES 42,000 is 3x regional average for appendectomy",
      },
    }),
  ])

  // ─── Deterministic Findings ──────────────────────────
  await Promise.all([
    prisma.finding.create({
      data: {
        claimId: claimB1.id,
        complianceRuleId: ruleMap["R-002"].id,
        type: "FACILITY_SERVICE_MISMATCH",
        severity: FindingSeverity.HIGH,
        source: FindingSource.RULE,
        title: "Facility Service Mismatch",
        explanation:
          "Claimed X-ray services but facility has no radiology capability",
        scoreContribution: 20,
      },
    }),
    prisma.finding.create({
      data: {
        claimId: claimC1.id,
        complianceRuleId: ruleMap["R-001"].id,
        type: "FACILITY_UNVERIFIED",
        severity: FindingSeverity.HIGH,
        source: FindingSource.RULE,
        title: "Unverified Facility",
        explanation: "Claim submitted by facility with UNVERIFIED status",
        scoreContribution: 25,
      },
    }),
    prisma.finding.create({
      data: {
        claimId: claimC2.id,
        complianceRuleId: ruleMap["R-002"].id,
        type: "SERVICE_MISMATCH",
        severity: FindingSeverity.CRITICAL,
        source: FindingSource.RULE,
        title: "MRI Service Not Available",
        explanation:
          "MRI scan claimed but clinic does not have radiology services",
        scoreContribution: 20,
      },
    }),
  ])

  // ─── Risk Scores ─────────────────────────────────────
  const riskB1 = await prisma.riskScore.create({
    data: {
      claimId: claimB1.id,
      score: 55,
      level: RiskLevel.HIGH,
    },
  })

  await prisma.riskContributor.createMany({
    data: [
      {
        riskScoreId: riskB1.id,
        type: "RULE",
        description: "Facility service mismatch",
        scoreImpact: 20,
      },
      {
        riskScoreId: riskB1.id,
        type: "RULE",
        description: "Unusual claim amount",
        scoreImpact: 15,
      },
      {
        riskScoreId: riskB1.id,
        type: "AI",
        description: "Service relevance concern",
        scoreImpact: 20,
      },
    ],
  })

  const riskB2 = await prisma.riskScore.create({
    data: {
      claimId: claimB2.id,
      score: 38,
      level: RiskLevel.MODERATE,
    },
  })

  await prisma.riskContributor.createMany({
    data: [
      {
        riskScoreId: riskB2.id,
        type: "RULE",
        description: "Unusual quantity",
        scoreImpact: 10,
      },
      {
        riskScoreId: riskB2.id,
        type: "RULE",
        description: "High claim amount",
        scoreImpact: 15,
      },
      {
        riskScoreId: riskB2.id,
        type: "AI",
        description: "Quantity anomaly detected",
        scoreImpact: 13,
      },
    ],
  })

  const riskC1 = await prisma.riskScore.create({
    data: {
      claimId: claimC1.id,
      score: 25,
      level: RiskLevel.MODERATE,
    },
  })

  await prisma.riskContributor.createMany({
    data: [
      {
        riskScoreId: riskC1.id,
        type: "RULE",
        description: "Unverified facility",
        scoreImpact: 25,
      },
    ],
  })

  const riskC2 = await prisma.riskScore.create({
    data: {
      claimId: claimC2.id,
      score: 85,
      level: RiskLevel.CRITICAL,
    },
  })

  await prisma.riskContributor.createMany({
    data: [
      {
        riskScoreId: riskC2.id,
        type: "RULE",
        description: "Unverified facility",
        scoreImpact: 25,
      },
      {
        riskScoreId: riskC2.id,
        type: "RULE",
        description: "Service mismatch - MRI",
        scoreImpact: 20,
      },
      {
        riskScoreId: riskC2.id,
        type: "SYSTEM",
        description: "Clinic requesting specialist imaging",
        scoreImpact: 40,
      },
    ],
  })

  const riskD2 = await prisma.riskScore.create({
    data: {
      claimId: claimD2.id,
      score: 65,
      level: RiskLevel.HIGH,
    },
  })

  await prisma.riskContributor.createMany({
    data: [
      {
        riskScoreId: riskD2.id,
        type: "RULE",
        description: "Unusually high surgical amount",
        scoreImpact: 15,
      },
      {
        riskScoreId: riskD2.id,
        type: "AI",
        description: "Amount anomaly - 3x regional average",
        scoreImpact: 50,
      },
    ],
  })

  // ─── Reviews ─────────────────────────────────────────
  const reviewB1 = await prisma.review.create({
    data: {
      claimId: claimB1.id,
      reviewerId: shaOfficer1.id,
      status: ReviewStatus.IN_PROGRESS,
      startedAt: new Date("2026-08-02T14:00:00Z"),
    },
  })

  await prisma.reviewAction.create({
    data: {
      reviewId: reviewB1.id,
      action: "REVIEW_STARTED",
      details: { notes: "Investigating facility service capabilities" },
    },
  })

  const reviewB2 = await prisma.review.create({
    data: {
      claimId: claimB2.id,
      reviewerId: shaOfficer2.id,
      status: ReviewStatus.COMPLETED,
      outcome: "CONFIRMED_ANOMALY",
      notes:
        "Confirmed unusual billing pattern. Quantities exceed standard protocols.",
      startedAt: new Date("2026-08-04T10:00:00Z"),
      completedAt: new Date("2026-08-04T16:30:00Z"),
    },
  })

  await prisma.reviewAction.create({
    data: {
      reviewId: reviewB2.id,
      action: "OUTCOME_RECORDED",
      details: {
        outcome: "CONFIRMED_ANOMALY",
        notes: "Billing irregularities confirmed",
      },
    },
  })

  const reviewD2 = await prisma.review.create({
    data: {
      claimId: claimD2.id,
      reviewerId: shaOfficer1.id,
      status: ReviewStatus.PENDING,
    },
  })

  // ─── Audit Logs ──────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        action: "SYSTEM_SEEDED",
        entityType: "System",
        entityId: "seed",
      },
      {
        userId: hospitalUserA.id,
        action: "CLAIM_SUBMITTED",
        entityType: "Claim",
        entityId: claimA1.id,
      },
      {
        userId: hospitalUserA.id,
        action: "CLAIM_SUBMITTED",
        entityType: "Claim",
        entityId: claimA2.id,
      },
      {
        userId: hospitalUserA.id,
        action: "CLAIM_SUBMITTED",
        entityType: "Claim",
        entityId: claimA3.id,
      },
      {
        userId: hospitalUserB.id,
        action: "CLAIM_SUBMITTED",
        entityType: "Claim",
        entityId: claimB1.id,
      },
      {
        userId: hospitalUserB.id,
        action: "CLAIM_SUBMITTED",
        entityType: "Claim",
        entityId: claimB2.id,
      },
      {
        userId: shaOfficer1.id,
        action: "CLAIM_FLAGGED",
        entityType: "Claim",
        entityId: claimB1.id,
      },
      {
        userId: shaOfficer1.id,
        action: "REVIEW_STARTED",
        entityType: "Review",
        entityId: reviewB1.id,
      },
      {
        userId: shaOfficer2.id,
        action: "CLAIM_FLAGGED",
        entityType: "Claim",
        entityId: claimB2.id,
      },
      {
        userId: shaOfficer2.id,
        action: "REVIEW_COMPLETED",
        entityType: "Review",
        entityId: reviewB2.id,
      },
      {
        userId: shaOfficer1.id,
        action: "CLAIM_FLAGGED",
        entityType: "Claim",
        entityId: claimD2.id,
      },
      {
        userId: shaOfficer1.id,
        action: "REVIEW_STARTED",
        entityType: "Review",
        entityId: reviewD2.id,
      },
    ],
  })

  // ─── Alerts ─────────────────────────────────────────────
  await prisma.alert.create({
    data: {
      type: "HIGH_RISK_CLAIM",
      severity: "HIGH",
      status: "UNDER_REVIEW",
      title: "High risk claim: CLM-2026-004",
      description:
        "Claim CLM-2026-004 from Coast Medical Centre has a high risk score of 55. Service mismatch and unusual billing detected.",
      claimId: claimB1.id,
      hospitalId: hospitalB.id,
      riskScoreId: riskB1.id,
      source: "SYSTEM",
      metadata: {
        riskScore: 55,
        riskLevel: "HIGH",
        findings: ["SERVICE_MISMATCH", "AMOUNT_ANOMALY"],
      },
    },
  })

  await prisma.alert.create({
    data: {
      type: "AI_REVIEW_REQUIRED",
      severity: "MEDIUM",
      status: "RESOLVED",
      title: "AI finding: Quantity anomaly in malaria treatment",
      description:
        "AI analysis identified medium severity concern: Elevated quantities for malaria treatment at Coast Medical Centre.",
      claimId: claimB2.id,
      hospitalId: hospitalB.id,
      riskScoreId: riskB2.id,
      source: "AI",
      resolvedAt: new Date("2026-08-05"),
      resolvedById: shaOfficer2.id,
      metadata: {
        findingCategory: "QUANTITY_ANOMALY",
        confidence: 0.72,
        resolutionNotes: "Confirmed anomaly - facility notified",
      },
    },
  })

  await prisma.alert.create({
    data: {
      type: "FACILITY_VERIFICATION",
      severity: "HIGH",
      status: "OPEN",
      title: "Unverified facility: Rift Valley Clinic",
      description:
        "Claim CLM-2026-006 submitted by unverified facility Rift Valley Clinic (UNVERIFIED).",
      claimId: claimC1.id,
      hospitalId: hospitalC.id,
      source: "RULE",
      metadata: {
        verificationStatus: "UNVERIFIED",
      },
    },
  })

  await prisma.alert.create({
    data: {
      type: "SERVICE_MISMATCH",
      severity: "CRITICAL",
      status: "OPEN",
      title: "Service mismatch: CLM-2026-007",
      description:
        "Claim CLM-2026-007 includes MRI services not authorized for Rift Valley Clinic.",
      claimId: claimC2.id,
      hospitalId: hospitalC.id,
      riskScoreId: riskC2.id,
      source: "RULE",
      metadata: {
        ruleCode: "R-002",
        serviceCode: "MRI",
      },
    },
  })

  await prisma.alert.create({
    data: {
      type: "HIGH_RISK_CLAIM",
      severity: "HIGH",
      status: "ACKNOWLEDGED",
      title: "High risk claim: CLM-2026-009",
      description:
        "Claim CLM-2026-009 from Western Province Hospital has a high risk score of 65. Unusually high surgical billing detected by AI analysis.",
      claimId: claimD2.id,
      hospitalId: hospitalD.id,
      riskScoreId: riskD2.id,
      source: "AI",
      metadata: {
        riskScore: 65,
        riskLevel: "HIGH",
        aiConfidence: 0.88,
        findingCategory: "AMOUNT_ANOMALY",
      },
    },
  })

  console.log("Seed completed successfully!")
  console.log(`  ${services.length} services`)
  console.log(`  ${rules.length} compliance rules`)
  console.log(`  5 hospitals`)
  console.log(`  8 users`)
  console.log(`  11 claims`)
  console.log(`  26 claim items`)
  console.log(`  3 AI analyses`)
  console.log(`  3 AI findings`)
  console.log(`  3 deterministic findings`)
  console.log(`  5 risk scores with contributors`)
  console.log(`  3 reviews`)
  console.log(`  5 alerts`)
  console.log(`  11 audit log entries`)
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
