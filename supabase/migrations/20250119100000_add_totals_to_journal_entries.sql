-- ============================================
-- Add total_debits and total_credits to journal_entries
-- ============================================
-- These columns store the totals for verification and quick access

-- Add total_debits and total_credits columns
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS total_debits NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_credits NUMERIC(15,2) DEFAULT 0;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_journal_entries_totals 
ON public.journal_entries(total_debits, total_credits);

-- Update existing entries to calculate totals
UPDATE public.journal_entries je
SET 
  total_debits = COALESCE((
    SELECT SUM(debit) 
    FROM public.journal_entry_lines 
    WHERE journal_entry_id = je.id
  ), 0),
  total_credits = COALESCE((
    SELECT SUM(credit) 
    FROM public.journal_entry_lines 
    WHERE journal_entry_id = je.id
  ), 0)
WHERE total_debits = 0 AND total_credits = 0;

-- Add comment
COMMENT ON COLUMN public.journal_entries.total_debits IS 'Sum of all debit amounts in this journal entry';
COMMENT ON COLUMN public.journal_entries.total_credits IS 'Sum of all credit amounts in this journal entry';

