-- AlterTable Permission
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "requisitionOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable SystemSettings
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "requisitionProcedures" JSONB;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "requisitionSamples" JSONB;

-- CreateTable ProcedureRequest
CREATE TABLE IF NOT EXISTS "ProcedureRequest" (
    "id" SERIAL NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientSex" TEXT,
    "hospitalID" TEXT NOT NULL,
    "patientType" TEXT NOT NULL DEFAULT 'IP',
    "ward" TEXT,
    "procedure" TEXT NOT NULL,
    "otherProcedure" TEXT,
    "fromWhere" TEXT NOT NULL,
    "samplesAnalysis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "otherSamples" TEXT,
    "requesterDesignation" TEXT,
    "requesterName" TEXT,
    "requesterContact" TEXT,
    "urgency" TEXT DEFAULT 'Routine',
    "clinicalNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "scheduledDate" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "notDoneReason" TEXT,
    "cancelledReason" TEXT,
    "workItemId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "ProcedureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ProcedureRequest_workItemId_key" ON "ProcedureRequest"("workItemId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcedureRequest_workItemId_fkey') THEN
        ALTER TABLE "ProcedureRequest" ADD CONSTRAINT "ProcedureRequest_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcedureRequest_createdById_fkey') THEN
        ALTER TABLE "ProcedureRequest" ADD CONSTRAINT "ProcedureRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProcedureRequest_updatedById_fkey') THEN
        ALTER TABLE "ProcedureRequest" ADD CONSTRAINT "ProcedureRequest_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
