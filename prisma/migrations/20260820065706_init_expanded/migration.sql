-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOSPITAL_USER', 'SHA_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HospitalStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED', 'PENDING', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'VALIDATING', 'ANALYZING', 'ASSESSED', 'CLEARED', 'FLAGGED', 'UNDER_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ClaimSource" AS ENUM ('HOSPITAL_PORTAL', 'API', 'IMPORT');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('RULE', 'AI', 'SYSTEM', 'REVIEW');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewOutcome" AS ENUM ('CLEARED', 'CONFIRMED_ANOMALY', 'REJECTED_CLAIM', 'ESCALATED', 'NEEDS_MORE_INFORMATION');

-- CreateEnum
CREATE TYPE "AiAnalysisStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('HIGH_RISK_CLAIM', 'FACILITY_VERIFICATION', 'SERVICE_MISMATCH', 'UNUSUAL_BILLING', 'DUPLICATE_CLAIM', 'AI_REVIEW_REQUIRED', 'FACILITY_LEVEL_MISMATCH', 'SERVICE_NOT_ACCREDITED', 'SERVICE_NOT_OFFERED', 'SERVICE_REQUIREMENT_MISSING', 'EQUIPMENT_UNAVAILABLE', 'EQUIPMENT_CAPACITY_EXCEEDED', 'SERVICE_CAPACITY_EXCEEDED', 'STAFF_CAPACITY_EXCEEDED', 'OPERATING_HOURS_ANOMALY', 'TARIFF_EXCEEDED', 'ENCOUNTER_BILLING_LIMIT_EXCEEDED', 'DAILY_BILLING_LIMIT_EXCEEDED', 'MONTHLY_BILLING_LIMIT_EXCEEDED', 'PATIENT_SERVICE_FREQUENCY_ANOMALY', 'PATIENT_SPENDING_ANOMALY', 'FACILITY_VOLUME_ANOMALY', 'FACILITY_PRICE_ANOMALY', 'NEAR_DUPLICATE_CLAIM', 'CROSS_FACILITY_ANOMALY', 'UNUSUAL_SERVICE_SEQUENCE', 'HISTORICAL_BEHAVIOR_ANOMALY');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('OPERATIONAL', 'MAINTENANCE', 'RETIRED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OUTPATIENT', 'INPATIENT', 'EMERGENCY', 'DAY_CASE', 'TELEHEALTH');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'PAID', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('DIAGNOSTIC', 'THERAPEUTIC', 'SURGICAL', 'LABORATORY', 'RADIOLOGY', 'PHARMACY', 'PREVENTIVE', 'REHABILITATION', 'MENTAL_HEALTH', 'DENTAL', 'OPTICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CapacityBasis" AS ENUM ('EQUIPMENT', 'STAFF', 'ROOMS', 'HOURS', 'MANUAL');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HOSPITAL_USER',
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityLevel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalEquipment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "operationalQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "acquisitionDate" TIMESTAMP(3),
    "installationDate" TIMESTAMP(3),
    "retirementDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentMaintenance" (
    "id" TEXT NOT NULL,
    "hospitalEquipmentId" TEXT NOT NULL,
    "equipmentTypeId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalStaff" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "activeQuantity" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalOperatingHours" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "is24Hour" BOOLEAN NOT NULL DEFAULT false,
    "openTime" TEXT,
    "closeTime" TEXT,
    "hasEmergency" BOOLEAN NOT NULL DEFAULT false,
    "serviceCode" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalOperatingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "facilityIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "facilityLevelId" TEXT,
    "status" "HospitalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "location" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "serviceType" "ServiceType" NOT NULL DEFAULT 'OTHER',
    "isInpatient" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalService" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequirement" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "requirementCode" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceEquipment" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "equipmentTypeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceStaff" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffTypeId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityLevelCapability" (
    "id" TEXT NOT NULL,
    "facilityLevelId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isExpected" BOOLEAN NOT NULL DEFAULT true,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "requiresAccreditation" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityLevelCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalServiceCapability" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isOffered" BOOLEAN NOT NULL DEFAULT true,
    "isAccredited" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "maxCapacity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalServiceCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "externalReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "encounterDate" TIMESTAMP(3) NOT NULL,
    "encounterType" "EncounterType" NOT NULL DEFAULT 'OUTPATIENT',
    "diagnosis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "admissionDate" TIMESTAMP(3),
    "dischargeDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientServiceHistory" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "encounterId" TEXT,
    "facilityLevelRank" INTEGER,
    "claimedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "claimDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientServiceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT,
    "encounterId" TEXT,
    "submittedById" TEXT,
    "patientReference" TEXT NOT NULL,
    "diagnosis" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ClaimSource" NOT NULL DEFAULT 'HOSPITAL_PORTAL',
    "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "rejectedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentAmountCents" INTEGER NOT NULL DEFAULT 0,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "approvedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "rejectedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "scoreContribution" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimRuleEvaluation" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "complianceRuleId" TEXT NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "scoreContribution" INTEGER NOT NULL DEFAULT 0,
    "explanation" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimRuleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "claimItemId" TEXT,
    "complianceRuleId" TEXT,
    "aiAnalysisId" TEXT,
    "type" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "source" "FindingSource" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT,
    "evidence" JSONB,
    "scoreContribution" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "AiAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "promptVersion" TEXT,
    "structuredResponse" JSONB,
    "confidence" DOUBLE PRECISION,
    "rawOutput" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiFinding" (
    "id" TEXT NOT NULL,
    "aiAnalysisId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "claimItemId" TEXT,
    "type" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskContributor" (
    "id" TEXT NOT NULL,
    "riskScoreId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "scoreImpact" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" "ReviewOutcome",
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAction" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "claimId" TEXT,
    "hospitalId" TEXT,
    "riskScoreId" TEXT,
    "source" "FindingSource" NOT NULL,
    "metadata" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTariff" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "facilityLevelId" TEXT,
    "hospitalId" TEXT,
    "patientCategory" TEXT,
    "unitAmountCents" INTEGER NOT NULL,
    "minAmountCents" INTEGER,
    "maxAmountCents" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPolicy" (
    "id" TEXT NOT NULL,
    "facilityLevelId" TEXT,
    "serviceId" TEXT,
    "hospitalId" TEXT,
    "maxPerEncounter" INTEGER,
    "maxPerService" INTEGER,
    "maxQtyPerService" INTEGER,
    "maxDailyAmount" INTEGER,
    "maxDailyQuantity" INTEGER,
    "maxMonthlyAmount" INTEGER,
    "maxMonthlyQuantity" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCapacity" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "theoreticalDailyCapacity" INTEGER,
    "operationalDailyCapacity" INTEGER,
    "weeklyCapacity" INTEGER,
    "monthlyCapacity" INTEGER,
    "operatingHours" TEXT,
    "averageProcedureDurationMinutes" INTEGER,
    "capacityBasis" "CapacityBasis" NOT NULL DEFAULT 'MANUAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_hospitalId_idx" ON "User"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityLevel_code_key" ON "FacilityLevel"("code");

-- CreateIndex
CREATE INDEX "FacilityLevel_code_idx" ON "FacilityLevel"("code");

-- CreateIndex
CREATE INDEX "FacilityLevel_rank_idx" ON "FacilityLevel"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentType_code_key" ON "EquipmentType"("code");

-- CreateIndex
CREATE INDEX "EquipmentType_code_idx" ON "EquipmentType"("code");

-- CreateIndex
CREATE INDEX "EquipmentType_category_idx" ON "EquipmentType"("category");

-- CreateIndex
CREATE INDEX "HospitalEquipment_hospitalId_idx" ON "HospitalEquipment"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalEquipment_equipmentTypeId_idx" ON "HospitalEquipment"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "HospitalEquipment_status_idx" ON "HospitalEquipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalEquipment_hospitalId_equipmentTypeId_key" ON "HospitalEquipment"("hospitalId", "equipmentTypeId");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_hospitalEquipmentId_idx" ON "EquipmentMaintenance"("hospitalEquipmentId");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_equipmentTypeId_idx" ON "EquipmentMaintenance"("equipmentTypeId");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_startDate_idx" ON "EquipmentMaintenance"("startDate");

-- CreateIndex
CREATE INDEX "EquipmentMaintenance_endDate_idx" ON "EquipmentMaintenance"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffType_code_key" ON "StaffType"("code");

-- CreateIndex
CREATE INDEX "StaffType_code_idx" ON "StaffType"("code");

-- CreateIndex
CREATE INDEX "StaffType_category_idx" ON "StaffType"("category");

-- CreateIndex
CREATE INDEX "HospitalStaff_hospitalId_idx" ON "HospitalStaff"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalStaff_staffTypeId_idx" ON "HospitalStaff"("staffTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalStaff_hospitalId_staffTypeId_key" ON "HospitalStaff"("hospitalId", "staffTypeId");

-- CreateIndex
CREATE INDEX "HospitalOperatingHours_hospitalId_idx" ON "HospitalOperatingHours"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalOperatingHours_dayOfWeek_idx" ON "HospitalOperatingHours"("dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalOperatingHours_hospitalId_dayOfWeek_serviceCode_key" ON "HospitalOperatingHours"("hospitalId", "dayOfWeek", "serviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_facilityIdentifier_key" ON "Hospital"("facilityIdentifier");

-- CreateIndex
CREATE INDEX "Hospital_status_idx" ON "Hospital"("status");

-- CreateIndex
CREATE INDEX "Hospital_verificationStatus_idx" ON "Hospital"("verificationStatus");

-- CreateIndex
CREATE INDEX "Hospital_facilityLevelId_idx" ON "Hospital"("facilityLevelId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

-- CreateIndex
CREATE INDEX "Service_serviceType_idx" ON "Service"("serviceType");

-- CreateIndex
CREATE INDEX "HospitalService_hospitalId_idx" ON "HospitalService"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalService_serviceId_idx" ON "HospitalService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalService_hospitalId_serviceId_key" ON "HospitalService"("hospitalId", "serviceId");

-- CreateIndex
CREATE INDEX "ServiceRequirement_serviceId_idx" ON "ServiceRequirement"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceRequirement_requirementType_idx" ON "ServiceRequirement"("requirementType");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequirement_serviceId_requirementType_requirementCod_key" ON "ServiceRequirement"("serviceId", "requirementType", "requirementCode");

-- CreateIndex
CREATE INDEX "ServiceEquipment_serviceId_idx" ON "ServiceEquipment"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceEquipment_equipmentTypeId_idx" ON "ServiceEquipment"("equipmentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceEquipment_serviceId_equipmentTypeId_key" ON "ServiceEquipment"("serviceId", "equipmentTypeId");

-- CreateIndex
CREATE INDEX "ServiceStaff_serviceId_idx" ON "ServiceStaff"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceStaff_staffTypeId_idx" ON "ServiceStaff"("staffTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceStaff_serviceId_staffTypeId_key" ON "ServiceStaff"("serviceId", "staffTypeId");

-- CreateIndex
CREATE INDEX "FacilityLevelCapability_facilityLevelId_idx" ON "FacilityLevelCapability"("facilityLevelId");

-- CreateIndex
CREATE INDEX "FacilityLevelCapability_serviceId_idx" ON "FacilityLevelCapability"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityLevelCapability_facilityLevelId_serviceId_key" ON "FacilityLevelCapability"("facilityLevelId", "serviceId");

-- CreateIndex
CREATE INDEX "HospitalServiceCapability_hospitalId_idx" ON "HospitalServiceCapability"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalServiceCapability_serviceId_idx" ON "HospitalServiceCapability"("serviceId");

-- CreateIndex
CREATE INDEX "HospitalServiceCapability_isAccredited_idx" ON "HospitalServiceCapability"("isAccredited");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalServiceCapability_hospitalId_serviceId_key" ON "HospitalServiceCapability"("hospitalId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_externalReference_key" ON "Patient"("externalReference");

-- CreateIndex
CREATE INDEX "Patient_externalReference_idx" ON "Patient"("externalReference");

-- CreateIndex
CREATE INDEX "Encounter_patientId_idx" ON "Encounter"("patientId");

-- CreateIndex
CREATE INDEX "Encounter_hospitalId_idx" ON "Encounter"("hospitalId");

-- CreateIndex
CREATE INDEX "Encounter_encounterDate_idx" ON "Encounter"("encounterDate");

-- CreateIndex
CREATE INDEX "Encounter_encounterType_idx" ON "Encounter"("encounterType");

-- CreateIndex
CREATE INDEX "PatientServiceHistory_patientId_idx" ON "PatientServiceHistory"("patientId");

-- CreateIndex
CREATE INDEX "PatientServiceHistory_serviceId_idx" ON "PatientServiceHistory"("serviceId");

-- CreateIndex
CREATE INDEX "PatientServiceHistory_claimDate_idx" ON "PatientServiceHistory"("claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "PatientServiceHistory_patientId_serviceId_claimDate_key" ON "PatientServiceHistory"("patientId", "serviceId", "claimDate");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_reference_key" ON "Claim"("reference");

-- CreateIndex
CREATE INDEX "Claim_hospitalId_idx" ON "Claim"("hospitalId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_submittedAt_idx" ON "Claim"("submittedAt");

-- CreateIndex
CREATE INDEX "Claim_reference_idx" ON "Claim"("reference");

-- CreateIndex
CREATE INDEX "Claim_source_idx" ON "Claim"("source");

-- CreateIndex
CREATE INDEX "Claim_patientId_idx" ON "Claim"("patientId");

-- CreateIndex
CREATE INDEX "Claim_encounterId_idx" ON "Claim"("encounterId");

-- CreateIndex
CREATE INDEX "Claim_billingStatus_idx" ON "Claim"("billingStatus");

-- CreateIndex
CREATE INDEX "ClaimItem_claimId_idx" ON "ClaimItem"("claimId");

-- CreateIndex
CREATE INDEX "ClaimItem_serviceId_idx" ON "ClaimItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceRule_code_key" ON "ComplianceRule"("code");

-- CreateIndex
CREATE INDEX "ComplianceRule_code_idx" ON "ComplianceRule"("code");

-- CreateIndex
CREATE INDEX "ComplianceRule_category_idx" ON "ComplianceRule"("category");

-- CreateIndex
CREATE INDEX "ComplianceRule_active_idx" ON "ComplianceRule"("active");

-- CreateIndex
CREATE INDEX "ClaimRuleEvaluation_claimId_idx" ON "ClaimRuleEvaluation"("claimId");

-- CreateIndex
CREATE INDEX "ClaimRuleEvaluation_complianceRuleId_idx" ON "ClaimRuleEvaluation"("complianceRuleId");

-- CreateIndex
CREATE INDEX "ClaimRuleEvaluation_triggered_idx" ON "ClaimRuleEvaluation"("triggered");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimRuleEvaluation_claimId_complianceRuleId_key" ON "ClaimRuleEvaluation"("claimId", "complianceRuleId");

-- CreateIndex
CREATE INDEX "Finding_claimId_idx" ON "Finding"("claimId");

-- CreateIndex
CREATE INDEX "Finding_claimItemId_idx" ON "Finding"("claimItemId");

-- CreateIndex
CREATE INDEX "Finding_source_idx" ON "Finding"("source");

-- CreateIndex
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");

-- CreateIndex
CREATE INDEX "Finding_type_idx" ON "Finding"("type");

-- CreateIndex
CREATE INDEX "AiAnalysis_claimId_idx" ON "AiAnalysis"("claimId");

-- CreateIndex
CREATE INDEX "AiAnalysis_status_idx" ON "AiAnalysis"("status");

-- CreateIndex
CREATE INDEX "AiAnalysis_provider_idx" ON "AiAnalysis"("provider");

-- CreateIndex
CREATE INDEX "AiFinding_aiAnalysisId_idx" ON "AiFinding"("aiAnalysisId");

-- CreateIndex
CREATE INDEX "AiFinding_claimId_idx" ON "AiFinding"("claimId");

-- CreateIndex
CREATE INDEX "AiFinding_severity_idx" ON "AiFinding"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "RiskScore_claimId_key" ON "RiskScore"("claimId");

-- CreateIndex
CREATE INDEX "RiskScore_level_idx" ON "RiskScore"("level");

-- CreateIndex
CREATE INDEX "RiskScore_score_idx" ON "RiskScore"("score");

-- CreateIndex
CREATE INDEX "RiskContributor_riskScoreId_idx" ON "RiskContributor"("riskScoreId");

-- CreateIndex
CREATE INDEX "Review_claimId_idx" ON "Review"("claimId");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "ReviewAction_reviewId_idx" ON "ReviewAction"("reviewId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_claimId_idx" ON "Alert"("claimId");

-- CreateIndex
CREATE INDEX "Alert_hospitalId_idx" ON "Alert"("hospitalId");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceTariff_serviceId_idx" ON "ServiceTariff"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceTariff_facilityLevelId_idx" ON "ServiceTariff"("facilityLevelId");

-- CreateIndex
CREATE INDEX "ServiceTariff_hospitalId_idx" ON "ServiceTariff"("hospitalId");

-- CreateIndex
CREATE INDEX "ServiceTariff_effectiveFrom_idx" ON "ServiceTariff"("effectiveFrom");

-- CreateIndex
CREATE INDEX "ServiceTariff_active_idx" ON "ServiceTariff"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTariff_serviceId_facilityLevelId_hospitalId_patientC_key" ON "ServiceTariff"("serviceId", "facilityLevelId", "hospitalId", "patientCategory");

-- CreateIndex
CREATE INDEX "BillingPolicy_facilityLevelId_idx" ON "BillingPolicy"("facilityLevelId");

-- CreateIndex
CREATE INDEX "BillingPolicy_serviceId_idx" ON "BillingPolicy"("serviceId");

-- CreateIndex
CREATE INDEX "BillingPolicy_hospitalId_idx" ON "BillingPolicy"("hospitalId");

-- CreateIndex
CREATE INDEX "BillingPolicy_effectiveFrom_idx" ON "BillingPolicy"("effectiveFrom");

-- CreateIndex
CREATE INDEX "BillingPolicy_active_idx" ON "BillingPolicy"("active");

-- CreateIndex
CREATE INDEX "ServiceCapacity_hospitalId_idx" ON "ServiceCapacity"("hospitalId");

-- CreateIndex
CREATE INDEX "ServiceCapacity_serviceId_idx" ON "ServiceCapacity"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCapacity_hospitalId_serviceId_key" ON "ServiceCapacity"("hospitalId", "serviceId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalEquipment" ADD CONSTRAINT "HospitalEquipment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalEquipment" ADD CONSTRAINT "HospitalEquipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentMaintenance" ADD CONSTRAINT "EquipmentMaintenance_hospitalEquipmentId_fkey" FOREIGN KEY ("hospitalEquipmentId") REFERENCES "HospitalEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentMaintenance" ADD CONSTRAINT "EquipmentMaintenance_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalStaff" ADD CONSTRAINT "HospitalStaff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalStaff" ADD CONSTRAINT "HospitalStaff_staffTypeId_fkey" FOREIGN KEY ("staffTypeId") REFERENCES "StaffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalOperatingHours" ADD CONSTRAINT "HospitalOperatingHours_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_facilityLevelId_fkey" FOREIGN KEY ("facilityLevelId") REFERENCES "FacilityLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalService" ADD CONSTRAINT "HospitalService_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalService" ADD CONSTRAINT "HospitalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequirement" ADD CONSTRAINT "ServiceRequirement_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipment" ADD CONSTRAINT "ServiceEquipment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceEquipment" ADD CONSTRAINT "ServiceEquipment_equipmentTypeId_fkey" FOREIGN KEY ("equipmentTypeId") REFERENCES "EquipmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_staffTypeId_fkey" FOREIGN KEY ("staffTypeId") REFERENCES "StaffType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityLevelCapability" ADD CONSTRAINT "FacilityLevelCapability_facilityLevelId_fkey" FOREIGN KEY ("facilityLevelId") REFERENCES "FacilityLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityLevelCapability" ADD CONSTRAINT "FacilityLevelCapability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalServiceCapability" ADD CONSTRAINT "HospitalServiceCapability_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalServiceCapability" ADD CONSTRAINT "HospitalServiceCapability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientServiceHistory" ADD CONSTRAINT "PatientServiceHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientServiceHistory" ADD CONSTRAINT "PatientServiceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimItem" ADD CONSTRAINT "ClaimItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimItem" ADD CONSTRAINT "ClaimItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRuleEvaluation" ADD CONSTRAINT "ClaimRuleEvaluation_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimRuleEvaluation" ADD CONSTRAINT "ClaimRuleEvaluation_complianceRuleId_fkey" FOREIGN KEY ("complianceRuleId") REFERENCES "ComplianceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_claimItemId_fkey" FOREIGN KEY ("claimItemId") REFERENCES "ClaimItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_complianceRuleId_fkey" FOREIGN KEY ("complianceRuleId") REFERENCES "ComplianceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_aiAnalysisId_fkey" FOREIGN KEY ("aiAnalysisId") REFERENCES "AiAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFinding" ADD CONSTRAINT "AiFinding_aiAnalysisId_fkey" FOREIGN KEY ("aiAnalysisId") REFERENCES "AiAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFinding" ADD CONSTRAINT "AiFinding_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFinding" ADD CONSTRAINT "AiFinding_claimItemId_fkey" FOREIGN KEY ("claimItemId") REFERENCES "ClaimItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskScore" ADD CONSTRAINT "RiskScore_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskContributor" ADD CONSTRAINT "RiskContributor_riskScoreId_fkey" FOREIGN KEY ("riskScoreId") REFERENCES "RiskScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAction" ADD CONSTRAINT "ReviewAction_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_riskScoreId_fkey" FOREIGN KEY ("riskScoreId") REFERENCES "RiskScore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTariff" ADD CONSTRAINT "ServiceTariff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTariff" ADD CONSTRAINT "ServiceTariff_facilityLevelId_fkey" FOREIGN KEY ("facilityLevelId") REFERENCES "FacilityLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTariff" ADD CONSTRAINT "ServiceTariff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPolicy" ADD CONSTRAINT "BillingPolicy_facilityLevelId_fkey" FOREIGN KEY ("facilityLevelId") REFERENCES "FacilityLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPolicy" ADD CONSTRAINT "BillingPolicy_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPolicy" ADD CONSTRAINT "BillingPolicy_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCapacity" ADD CONSTRAINT "ServiceCapacity_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceCapacity" ADD CONSTRAINT "ServiceCapacity_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
