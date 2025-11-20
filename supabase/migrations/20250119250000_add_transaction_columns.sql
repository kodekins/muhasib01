-- Add missing columns to transactions table for proper transaction recording

-- Add transaction_type column to differentiate invoice, payment, bill, etc.
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS transaction_type TEXT;

-- Add reference_id to link to source record (invoice_id, payment_id, bill_id, etc.)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Update status to allow 'posted' value
ALTER TABLE public.transactions
ALTER COLUMN status DROP DEFAULT;

-- Drop the old enum constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    ALTER TABLE public.transactions ALTER COLUMN status TYPE TEXT;
    DROP TYPE IF EXISTS public.transaction_status CASCADE;
  END IF;
END $$;

-- Recreate status column as TEXT with CHECK constraint
ALTER TABLE public.transactions 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add CHECK constraint for valid status values
ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pending', 'cleared', 'reconciled', 'posted'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON public.transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);

-- Add comment for clarity
COMMENT ON COLUMN public.transactions.transaction_type IS 'Type of transaction: invoice, payment, bill, journal_entry, etc.';
COMMENT ON COLUMN public.transactions.reference_id IS 'ID of the source record (invoice, payment, bill, journal entry, etc.)';
COMMENT ON COLUMN public.transactions.reference_number IS 'Human-readable reference (invoice number, payment number, etc.)';

