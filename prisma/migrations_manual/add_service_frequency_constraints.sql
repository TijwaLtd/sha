-- Migration: Add Service Frequency Constraints
-- This adds service-specific frequency rules for cross-facility duplicate detection

-- Create the ServiceFrequencyConstraint table
CREATE TABLE IF NOT EXISTS "ServiceFrequencyConstraint" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "minDaysBetweenClaims" INTEGER NOT NULL DEFAULT 0,
    "maxClaimsPerPeriod" INTEGER,
    "periodDays" INTEGER,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceFrequencyConstraint_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on serviceId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ServiceFrequencyConstraint_serviceId_key'
    ) THEN
        ALTER TABLE "ServiceFrequencyConstraint" 
        ADD CONSTRAINT "ServiceFrequencyConstraint_serviceId_key" UNIQUE ("serviceId");
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "ServiceFrequencyConstraint_serviceId_idx" ON "ServiceFrequencyConstraint"("serviceId");
CREATE INDEX IF NOT EXISTS "ServiceFrequencyConstraint_active_idx" ON "ServiceFrequencyConstraint"("active");

-- Add foreign key constraint to Service table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ServiceFrequencyConstraint_serviceId_fkey'
    ) THEN
        ALTER TABLE "ServiceFrequencyConstraint" 
        ADD CONSTRAINT "ServiceFrequencyConstraint_serviceId_fkey" 
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Add updatedAt trigger if it doesn't exist
CREATE OR REPLACE FUNCTION "updateServiceFrequencyConstraintUpdatedAt"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ServiceFrequencyConstraint_updatedAt" ON "ServiceFrequencyConstraint";
CREATE TRIGGER "ServiceFrequencyConstraint_updatedAt"
BEFORE UPDATE ON "ServiceFrequencyConstraint"
FOR EACH ROW
EXECUTE FUNCTION "updateServiceFrequencyConstraintUpdatedAt"();

-- Insert sample frequency constraints for surgical services
-- These will be used by the enhanced R-007 rule for service-specific detection

INSERT INTO "ServiceFrequencyConstraint" ("id", "serviceId", "minDaysBetweenClaims", "maxClaimsPerPeriod", "periodDays", "severity", "active", "notes")
SELECT 
    gen_random_uuid()::text,
    s.id,
    CASE 
        WHEN s.code IN ('SURGERY_MAJOR', 'ORTHO_SURGERY', 'DELIVERY_CS') THEN 30  -- Major surgeries: 30 days minimum
        WHEN s.code IN ('SURGERY_MINOR') THEN 14  -- Minor surgeries: 14 days minimum
        WHEN s.code IN ('CT_SCAN', 'MRI') THEN 7  -- Advanced imaging: 7 days minimum
        WHEN s.code IN ('X_RAY', 'ULTRASOUND') THEN 3  -- Basic imaging: 3 days minimum
        ELSE 0  -- Other services: no restriction
    END,
    CASE 
        WHEN s.code IN ('SURGERY_MAJOR', 'ORTHO_SURGERY') THEN 2  -- Max 2 major surgeries per year
        WHEN s.code IN ('CT_SCAN', 'MRI') THEN 4  -- Max 4 advanced scans per quarter
        ELSE NULL
    END,
    CASE 
        WHEN s.code IN ('SURGERY_MAJOR', 'ORTHO_SURGERY') THEN 365  -- Period: 1 year
        WHEN s.code IN ('CT_SCAN', 'MRI') THEN 90  -- Period: 90 days
        ELSE NULL
    END,
    'HIGH',
    true,
    CASE 
        WHEN s.code IN ('SURGERY_MAJOR', 'ORTHO_SURGERY', 'DELIVERY_CS') THEN 'Major surgical procedures - medical necessity unlikely within 30 days'
        WHEN s.code IN ('SURGERY_MINOR') THEN 'Minor surgical procedures - 14 day minimum for recovery'
        WHEN s.code IN ('CT_SCAN', 'MRI') THEN 'Advanced imaging - 7 day minimum for clinical justification'
        WHEN s.code IN ('X_RAY', 'ULTRASOUND') THEN 'Basic imaging - 3 day minimum'
        ELSE 'Standard service frequency'
    END
FROM "Service" s
WHERE s.code IN ('SURGERY_MAJOR', 'ORTHO_SURGERY', 'DELIVERY_CS', 'SURGERY_MINOR', 'CT_SCAN', 'MRI', 'X_RAY', 'ULTRASOUND')
ON CONFLICT ("serviceId") DO NOTHING;