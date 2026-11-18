-- AlterTable SystemSettings
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "requisitionOrders" JSONB;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "requisitionWards" JSONB;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "requisitionDesignations" JSONB;

-- AlterTable ProcedureRequest
ALTER TABLE "ProcedureRequest" ADD COLUMN IF NOT EXISTS "genericOrders" JSONB;
ALTER TABLE "ProcedureRequest" ADD COLUMN IF NOT EXISTS "referringConsultant" TEXT;
ALTER TABLE "ProcedureRequest" ADD COLUMN IF NOT EXISTS "modality" TEXT;
