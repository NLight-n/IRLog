-- AlterTable
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "editApptCard" BOOLEAN NOT NULL DEFAULT false;

-- Grant editApptCard to existing admins and users who currently have edit permissions
UPDATE "Permission" 
SET "editApptCard" = true 
WHERE "manageUsers" = true OR "editProcedureLog" = true;
