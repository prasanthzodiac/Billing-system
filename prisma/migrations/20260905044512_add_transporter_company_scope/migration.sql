/*
  Warnings:

  - Added the required column `companyId` to the `Transporter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transporter` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Invoice_companyId_dueDate_status_idx";

-- AlterTable
ALTER TABLE "Transporter" ADD COLUMN     "companyId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Transporter_companyId_name_idx" ON "Transporter"("companyId", "name");

-- CreateIndex
CREATE INDEX "Transporter_companyId_active_idx" ON "Transporter"("companyId", "active");

-- AddForeignKey
ALTER TABLE "Transporter" ADD CONSTRAINT "Transporter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
