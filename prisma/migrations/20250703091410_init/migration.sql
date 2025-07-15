-- CreateTable
CREATE TABLE "User" (
    "userID" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "viewOnly" BOOLEAN NOT NULL DEFAULT true,
    "createProcedureLog" BOOLEAN NOT NULL DEFAULT false,
    "editProcedureLog" BOOLEAN NOT NULL DEFAULT false,
    "editSettings" BOOLEAN NOT NULL DEFAULT false,
    "manageUsers" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureLog" (
    "procedureID" SERIAL NOT NULL,
    "patientID" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientSex" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "procedureRef" INTEGER,
    "procedureDate" TIMESTAMP(3) NOT NULL,
    "procedureTime" TEXT NOT NULL,
    "refPhysician" INTEGER,
    "procedureNotesText" TEXT,
    "procedureNotesFilePath" TEXT,
    "followUp" TEXT,
    "notes" TEXT,
    "procedureCost" DOUBLE PRECISION,
    "diagnosis" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "updatedById" INTEGER,

    CONSTRAINT "ProcedureLog_pkey" PRIMARY KEY ("procedureID")
);

-- CreateTable
CREATE TABLE "Physician" (
    "physicianID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Physician_pkey" PRIMARY KEY ("physicianID")
);

-- CreateTable
CREATE TABLE "ProcedurePhysicians" (
    "id" SERIAL NOT NULL,
    "procedureID" INTEGER NOT NULL,
    "physicianID" INTEGER NOT NULL,

    CONSTRAINT "ProcedurePhysicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "proID" SERIAL NOT NULL,
    "patientStatus" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "procedureCost" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("proID")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "logID" SERIAL NOT NULL,
    "actionType" TEXT NOT NULL,
    "userID" INTEGER NOT NULL,
    "affectedTable" TEXT NOT NULL,
    "affectedRowID" INTEGER NOT NULL,
    "dataBefore" JSONB,
    "dataAfter" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("logID")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_procedureRef_fkey" FOREIGN KEY ("procedureRef") REFERENCES "Procedure"("proID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_refPhysician_fkey" FOREIGN KEY ("refPhysician") REFERENCES "Physician"("physicianID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLog" ADD CONSTRAINT "ProcedureLog_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedurePhysicians" ADD CONSTRAINT "ProcedurePhysicians_procedureID_fkey" FOREIGN KEY ("procedureID") REFERENCES "ProcedureLog"("procedureID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedurePhysicians" ADD CONSTRAINT "ProcedurePhysicians_physicianID_fkey" FOREIGN KEY ("physicianID") REFERENCES "Physician"("physicianID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;
