-- CreateTable
CREATE TABLE "Settings" (
    "id" SERIAL NOT NULL,
    "userID" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "columns" JSONB,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Settings_userID_key" ON "Settings"("userID");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE RESTRICT ON UPDATE CASCADE;
