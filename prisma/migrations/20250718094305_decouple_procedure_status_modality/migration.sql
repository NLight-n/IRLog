/*
  Warnings:

  - You are about to drop the column `modality` on the `Procedure` table. All the data in the column will be lost.
  - You are about to drop the column `patientStatus` on the `Procedure` table. All the data in the column will be lost.
  - You are about to drop the column `procedureRef` on the `ProcedureLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProcedureLog" DROP CONSTRAINT "ProcedureLog_procedureRef_fkey";

-- AlterTable
ALTER TABLE "Procedure" DROP COLUMN "modality",
DROP COLUMN "patientStatus";

-- AlterTable
ALTER TABLE "ProcedureLog" DROP COLUMN "procedureRef",
ADD COLUMN     "modality" TEXT NOT NULL DEFAULT 'DSA',
ADD COLUMN     "procedureName" TEXT NOT NULL DEFAULT 'DSA',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'IP';
