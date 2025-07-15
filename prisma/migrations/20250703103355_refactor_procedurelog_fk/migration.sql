/*
  Warnings:

  - You are about to drop the column `modality` on the `ProcedureLog` table. All the data in the column will be lost.
  - You are about to drop the column `procedureName` on the `ProcedureLog` table. All the data in the column will be lost.
  - Made the column `procedureRef` on table `ProcedureLog` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ProcedureLog" DROP CONSTRAINT "ProcedureLog_procedureRef_fkey";

-- AlterTable
ALTER TABLE "ProcedureLog" DROP COLUMN "modality",
DROP COLUMN "procedureName",
ALTER COLUMN "procedureRef" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_procedureRef_fkey" FOREIGN KEY ("procedureRef") REFERENCES "Procedure"("proID") ON DELETE RESTRICT ON UPDATE CASCADE;
