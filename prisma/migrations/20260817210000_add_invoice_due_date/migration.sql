ALTER TABLE "Invoice" ADD COLUMN "dueDate" TIMESTAMP(3);

CREATE INDEX "Invoice_companyId_dueDate_status_idx" ON "Invoice"("companyId", "dueDate", "status");
