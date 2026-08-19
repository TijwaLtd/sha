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

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HOSPITAL_USER',
    "hospitalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "facilityIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" "HospitalStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "location" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "submittedById" TEXT,
    "patientReference" TEXT NOT NULL,
    "diagnosis" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ClaimSource" NOT NULL DEFAULT 'HOSPITAL_PORTAL',
    "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_hospitalId_idx" ON "User"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_facilityIdentifier_key" ON "Hospital"("facilityIdentifier");

-- CreateIndex
CREATE INDEX "Hospital_status_idx" ON "Hospital"("status");

-- CreateIndex
CREATE INDEX "Hospital_verificationStatus_idx" ON "Hospital"("verificationStatus");

-- CreateIndex
CREATE INDEX "HospitalService_hospitalId_idx" ON "HospitalService"("hospitalId");

-- CreateIndex
CREATE INDEX "HospitalService_serviceId_idx" ON "HospitalService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalService_hospitalId_serviceId_key" ON "HospitalService"("hospitalId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "Service"("category");

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

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalService" ADD CONSTRAINT "HospitalService_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalService" ADD CONSTRAINT "HospitalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
