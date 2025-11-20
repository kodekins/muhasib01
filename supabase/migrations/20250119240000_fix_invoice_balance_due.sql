-- Fix Invoice Balance Due Values
-- This migration ensures all invoices have correct balance_due values

-- Update balance_due for all invoices where it's incorrectly set to 0
-- balance_due should be: total_amount - amount_paid
UPDATE public.invoices
SET balance_due = total_amount - amount_paid
WHERE balance_due = 0
  AND total_amount > 0
  AND status NOT IN ('paid', 'void', 'cancelled')
  AND document_type = 'invoice'; -- Only fix invoices, not quotations

-- Update balance_due for all invoices to ensure consistency
-- This catches any invoices where balance_due doesn't match the calculation
UPDATE public.invoices
SET balance_due = total_amount - amount_paid
WHERE document_type = 'invoice'
  AND status NOT IN ('void', 'cancelled')
  AND balance_due != (total_amount - amount_paid);

-- Add a helpful comment
COMMENT ON COLUMN public.invoices.balance_due IS 'Current outstanding balance (total_amount - amount_paid). Should be 0 for quotations.';

