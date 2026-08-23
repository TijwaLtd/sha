-- CreateTable
CREATE TABLE "RuleParameter" (
    "id" TEXT NOT NULL,
    "complianceRuleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleParameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuleParameter_complianceRuleId_key_key" ON "RuleParameter"("complianceRuleId", "key");

-- CreateIndex
CREATE INDEX "RuleParameter_complianceRuleId_idx" ON "RuleParameter"("complianceRuleId");

-- AddForeignKey
ALTER TABLE "RuleParameter" ADD CONSTRAINT "RuleParameter_complianceRuleId_fkey" FOREIGN KEY ("complianceRuleId") REFERENCES "ComplianceRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
