-- Add Opening Balance to Accounts
-- Allows setting initial balance when creating accounts
-- Creates proper journal entries for opening balances

-- ============================================
-- 1. ADD OPENING_BALANCE COLUMN
-- ============================================

-- Add opening_balance column to accounts table
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(15,2) DEFAULT 0;

-- Add opening_balance_date to track when the balance was set
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance_date DATE;

-- Add flag to track if opening balance has been recorded
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance_recorded BOOLEAN DEFAULT false;

-- Add reference to opening balance journal entry
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS opening_balance_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_accounts_opening_balance_recorded 
ON public.accounts(opening_balance_recorded);

-- ============================================
-- 3. COMMENTS
-- ============================================

COMMENT ON COLUMN public.accounts.opening_balance IS 'Initial balance when account is created. Used to generate opening balance journal entry.';
COMMENT ON COLUMN public.accounts.opening_balance_date IS 'Date of the opening balance (usually business start date or account creation date)';
COMMENT ON COLUMN public.accounts.opening_balance_recorded IS 'True if opening balance journal entry has been created';
COMMENT ON COLUMN public.accounts.opening_balance_entry_id IS 'Reference to the journal entry that recorded the opening balance';

-- ============================================
-- 4. UPDATE EXISTING ACCOUNTS
-- ============================================

-- Set opening_balance_recorded to true for existing accounts with transactions
-- This prevents accidentally creating opening balance entries for accounts already in use
UPDATE public.accounts
SET opening_balance_recorded = true
WHERE EXISTS (
  SELECT 1 FROM public.journal_entry_lines 
  WHERE journal_entry_lines.account_id = accounts.id
);

-- ============================================
-- 5. NOTES
-- ============================================

-- HOW TO USE:
-- 1. When creating a new account, user can optionally set an opening_balance
-- 2. The application code should create a journal entry to record this balance
-- 3. Opening balance entries use "Opening Balance" as description
-- 4. Debit/Credit depends on account type:
--    - Assets & Expenses: Opening balance goes to DEBIT side
--    - Liabilities, Equity, Revenue: Opening balance goes to CREDIT side
-- 5. The offsetting entry typically goes to an "Opening Balance Equity" account (3900)

-- EXAMPLE OPENING BALANCE ENTRIES:
-- 
-- For Bank Account (Asset) with $10,000 opening balance:
--   DEBIT: 1010 - Bank Account: $10,000
--   CREDIT: 3900 - Opening Balance Equity: $10,000
--
-- For Loan (Liability) with $5,000 opening balance:
--   DEBIT: 3900 - Opening Balance Equity: $5,000
--   CREDIT: 2200 - Loan Payable: $5,000

