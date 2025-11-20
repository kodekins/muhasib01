-- Enhanced Bookkeeping Accounts Migration
-- Adds proper accounts for complete double-entry bookkeeping
-- Run this AFTER the previous migrations

-- Function to safely add accounts only if they don't exist
CREATE OR REPLACE FUNCTION add_default_bookkeeping_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all users and add missing accounts
  FOR user_record IN SELECT id FROM auth.users LOOP
    
    -- Add Sales Tax Payable (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Sales Tax Payable',
      '2100',
      'liability'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '2100'
    );
    
    -- Add Sales Tax Expense (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Sales Tax Expense',
      '5100',
      'expense'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '5100'
    );
    
    -- Add Sales Discounts (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Sales Discounts',
      '4100',
      'revenue'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '4100'
    );
    
    -- Add Purchase Discounts (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Purchase Discounts',
      '5200',
      'expense'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '5200'
    );
    
    -- Add Cost of Goods Sold (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Cost of Goods Sold',
      '5000',
      'expense'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '5000'
    );
    
    -- Add Inventory (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Inventory',
      '1300',
      'asset'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '1300'
    );
    
    -- Add Prepaid Expenses (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Prepaid Expenses',
      '1400',
      'asset'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '1400'
    );
    
    -- Add Accumulated Depreciation (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Accumulated Depreciation',
      '1900',
      'asset'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '1900'
    );
    
    -- Add Unearned Revenue (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Unearned Revenue',
      '2200',
      'liability'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '2200'
    );
    
    -- Add Retained Earnings (if not exists)
    INSERT INTO public.accounts (user_id, name, code, account_type)
    SELECT 
      user_record.id,
      'Retained Earnings',
      '3100',
      'equity'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounts 
      WHERE user_id = user_record.id 
      AND code = '3100'
    );
    
  END LOOP;
END;
$$;

-- Execute the function to add accounts to existing users
SELECT add_default_bookkeeping_accounts();

-- Update the handle_new_user function to include these accounts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  
  -- Create comprehensive chart of accounts
  INSERT INTO public.accounts (user_id, name, code, account_type) VALUES
    -- ASSETS
    (NEW.id, 'Cash', '1000', 'asset'),
    (NEW.id, 'Bank Account', '1010', 'asset'),
    (NEW.id, 'Accounts Receivable', '1200', 'asset'),
    (NEW.id, 'Inventory', '1300', 'asset'),
    (NEW.id, 'Prepaid Expenses', '1400', 'asset'),
    (NEW.id, 'Accumulated Depreciation', '1900', 'asset'),
    
    -- LIABILITIES
    (NEW.id, 'Accounts Payable', '2000', 'liability'),
    (NEW.id, 'Sales Tax Payable', '2100', 'liability'),
    (NEW.id, 'Unearned Revenue', '2200', 'liability'),
    
    -- EQUITY
    (NEW.id, 'Owner Equity', '3000', 'equity'),
    (NEW.id, 'Retained Earnings', '3100', 'equity'),
    
    -- REVENUE
    (NEW.id, 'Revenue', '4000', 'revenue'),
    (NEW.id, 'Sales Discounts', '4100', 'revenue'),
    
    -- EXPENSES
    (NEW.id, 'Cost of Goods Sold', '5000', 'expense'),
    (NEW.id, 'Operating Expenses', '5001', 'expense'),
    (NEW.id, 'Sales Tax Expense', '5100', 'expense'),
    (NEW.id, 'Purchase Discounts', '5200', 'expense');
    
  -- Create default categories
  INSERT INTO public.categories (user_id, name, description, color) VALUES
    (NEW.id, 'Office Supplies', 'Office equipment and supplies', '#ef4444'),
    (NEW.id, 'Travel', 'Business travel expenses', '#f97316'),
    (NEW.id, 'Marketing', 'Marketing and advertising', '#8b5cf6'),
    (NEW.id, 'Software', 'Software subscriptions and licenses', '#06b6d4'),
    (NEW.id, 'Utilities', 'Office utilities', '#10b981'),
    (NEW.id, 'Sales', 'Revenue from sales', '#22c55e'),
    (NEW.id, 'Services', 'Revenue from services', '#3b82f6');

  RETURN NEW;
END;
$$;

-- Add helpful views for bookkeeping

-- View: Account Balances
CREATE OR REPLACE VIEW account_balances AS
SELECT 
  a.id,
  a.user_id,
  a.name,
  a.code,
  a.account_type,
  COALESCE(SUM(
    CASE 
      WHEN a.account_type IN ('asset', 'expense') THEN jel.debit - jel.credit
      WHEN a.account_type IN ('liability', 'equity', 'revenue') THEN jel.credit - jel.debit
      ELSE 0
    END
  ), 0) as balance,
  COUNT(jel.id) as transaction_count
FROM accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
GROUP BY a.id, a.user_id, a.name, a.code, a.account_type;

-- Grant permissions
GRANT SELECT ON account_balances TO authenticated;

-- Add comment
COMMENT ON VIEW account_balances IS 'Real-time account balances calculated from journal entries';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status_due_date ON invoices(status, due_date);
CREATE INDEX IF NOT EXISTS idx_bills_status_due_date ON bills(status, due_date);

-- Add RLS policy for account_balances view
ALTER VIEW account_balances SET (security_invoker = true);

