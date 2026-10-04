ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reversedById" TEXT,
ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_reversedById_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey"
      FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
