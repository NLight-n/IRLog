-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "appHeading" TEXT DEFAULT 'Interventional Radiology',
ADD COLUMN     "appSubheading" TEXT DEFAULT '',
ADD COLUMN     "currency" TEXT DEFAULT '$',
ADD COLUMN     "dateFormat" TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN     "timeFormat" TEXT DEFAULT '24hr';
