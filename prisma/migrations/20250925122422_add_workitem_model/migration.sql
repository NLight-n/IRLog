-- CreateTable
CREATE TABLE "WorkItem" (
    "id" SERIAL NOT NULL,
    "patientID" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "modality" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Pending',
    "dateAdded" TIMESTAMP(3),
    "dateEvaluated" TIMESTAMP(3),
    "dateScheduled" TIMESTAMP(3),
    "dateDone" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;
