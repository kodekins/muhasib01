-- ============================================
-- FULL BOOKKEEPING SYSTEM
-- ============================================
-- Implements double-entry bookkeeping with:
-- - Journal entries
-- - Invoices with line items
-- - Bills with line items
-- - Products/Services catalog
-- - Payments tracking
-- - Bank accounts
-- - Multi-entity support
-- ============================================

-- ============================================
-- 1. JOURNAL ENTRIES (Double-Entry Bookkeeping)
-- ============================================

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_number TEXT, -- e.g., JE-001
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT, -- Reference to source document
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  source_type TEXT, -- 'invoice', 'bill', 'payment', 'manual', etc.
  source_id UUID, -- ID of source document
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Journal entry lines (debits and credits)
CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  entity_type TEXT, -- 'customer', 'vendor', 'employee', etc.
  entity_id UUID, -- ID of related entity
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 2. PRODUCTS & SERVICES
-- ============================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'service' CHECK (type IN ('service', 'product', 'inventory')),
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  cost NUMERIC(15,2) DEFAULT 0,
  income_account_id UUID REFERENCES public.accounts(id),
  expense_account_id UUID REFERENCES public.accounts(id),
  inventory_account_id UUID REFERENCES public.accounts(id),
  -- Inventory tracking
  track_inventory BOOLEAN DEFAULT false,
  quantity_on_hand NUMERIC(15,2) DEFAULT 0,
  reorder_point NUMERIC(15,2) DEFAULT 0,
  -- Tax settings
  taxable BOOLEAN DEFAULT true,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sku)
);

-- ============================================
-- 3. INVOICES
-- ============================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void')),
  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  balance_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Details
  notes TEXT,
  terms TEXT,
  footer TEXT,
  -- References
  purchase_order TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, invoice_number)
);

-- Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 4. BILLS (Vendor Bills)
-- ============================================

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'partial', 'paid', 'overdue', 'void')),
  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  balance_due NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Details
  notes TEXT,
  terms TEXT,
  -- References
  purchase_order TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  -- Tracking
  received_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, bill_number)
);

-- Bill line items
CREATE TABLE IF NOT EXISTS public.bill_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 5. PAYMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_number TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('invoice_payment', 'bill_payment', 'customer_refund', 'vendor_refund')),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'check', 'credit_card', 'debit_card', 'bank_transfer', 'ach', 'other')),
  -- Entity references
  customer_id UUID REFERENCES public.customers(id),
  vendor_id UUID REFERENCES public.vendors(id),
  -- Amount
  amount NUMERIC(15,2) NOT NULL,
  -- Bank account
  bank_account_id UUID REFERENCES public.accounts(id),
  -- References
  reference_number TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  notes TEXT,
  -- Tracking
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'void', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payment applications (link payments to invoices/bills)
CREATE TABLE IF NOT EXISTS public.payment_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id),
  bill_id UUID REFERENCES public.bills(id),
  amount_applied NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (
    (invoice_id IS NOT NULL AND bill_id IS NULL) OR
    (invoice_id IS NULL AND bill_id IS NOT NULL)
  )
);

-- ============================================
-- 6. BANK ACCOUNTS & RECONCILIATION
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  routing_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'credit_card', 'money_market', 'loan')),
  opening_balance NUMERIC(15,2) DEFAULT 0,
  current_balance NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_reconciled_date DATE,
  last_reconciled_balance NUMERIC(15,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bank reconciliation
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  reconciliation_date DATE NOT NULL,
  statement_date DATE NOT NULL,
  statement_balance NUMERIC(15,2) NOT NULL,
  book_balance NUMERIC(15,2) NOT NULL,
  difference NUMERIC(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'void')),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 7. ESTIMATES/QUOTES
-- ============================================

CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  estimate_number TEXT NOT NULL,
  estimate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted')),
  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Details
  notes TEXT,
  terms TEXT,
  footer TEXT,
  -- Conversion
  invoice_id UUID REFERENCES public.invoices(id),
  converted_at TIMESTAMP WITH TIME ZONE,
  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, estimate_number)
);

-- Estimate line items
CREATE TABLE IF NOT EXISTS public.estimate_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  description TEXT NOT NULL,
  quantity NUMERIC(15,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 8. TAX RATES
-- ============================================

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  tax_account_id UUID REFERENCES public.accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Journal entries policies
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON public.journal_entries;
CREATE POLICY "Users can manage their own journal entries" ON public.journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own journal entry lines" ON public.journal_entry_lines;
CREATE POLICY "Users can manage their own journal entry lines" ON public.journal_entry_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.journal_entries 
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id 
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Products policies
DROP POLICY IF EXISTS "Users can manage their own products" ON public.products;
CREATE POLICY "Users can manage their own products" ON public.products
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Invoices policies
DROP POLICY IF EXISTS "Users can manage their own invoices" ON public.invoices;
CREATE POLICY "Users can manage their own invoices" ON public.invoices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own invoice lines" ON public.invoice_lines;
CREATE POLICY "Users can manage their own invoice lines" ON public.invoice_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE invoices.id = invoice_lines.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

-- Bills policies
DROP POLICY IF EXISTS "Users can manage their own bills" ON public.bills;
CREATE POLICY "Users can manage their own bills" ON public.bills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own bill lines" ON public.bill_lines;
CREATE POLICY "Users can manage their own bill lines" ON public.bill_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bills 
      WHERE bills.id = bill_lines.bill_id 
      AND bills.user_id = auth.uid()
    )
  );

-- Payments policies
DROP POLICY IF EXISTS "Users can manage their own payments" ON public.payments;
CREATE POLICY "Users can manage their own payments" ON public.payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own payment applications" ON public.payment_applications;
CREATE POLICY "Users can manage their own payment applications" ON public.payment_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.payments 
      WHERE payments.id = payment_applications.payment_id 
      AND payments.user_id = auth.uid()
    )
  );

-- Bank accounts policies
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own bank reconciliations" ON public.bank_reconciliations;
CREATE POLICY "Users can manage their own bank reconciliations" ON public.bank_reconciliations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Estimates policies
DROP POLICY IF EXISTS "Users can manage their own estimates" ON public.estimates;
CREATE POLICY "Users can manage their own estimates" ON public.estimates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own estimate lines" ON public.estimate_lines;
CREATE POLICY "Users can manage their own estimate lines" ON public.estimate_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estimates 
      WHERE estimates.id = estimate_lines.estimate_id 
      AND estimates.user_id = auth.uid()
    )
  );

-- Tax rates policies
DROP POLICY IF EXISTS "Users can manage their own tax rates" ON public.tax_rates;
CREATE POLICY "Users can manage their own tax rates" ON public.tax_rates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON public.journal_entries(status);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON public.journal_entry_lines(account_id);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON public.invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON public.invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_product_id ON public.invoice_lines(product_id);

CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON public.bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON public.bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_date ON public.bills(bill_date);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date);
CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON public.bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_product_id ON public.bill_lines(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id ON public.payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_applications_payment_id ON public.payment_applications(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_invoice_id ON public.payment_applications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_applications_bill_id ON public.payment_applications(bill_id);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON public.bank_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_bank_account_id ON public.bank_reconciliations(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_date ON public.bank_reconciliations(reconciliation_date);

CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_customer_id ON public.estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON public.estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate_id ON public.estimate_lines(estimate_id);

CREATE INDEX IF NOT EXISTS idx_tax_rates_user_id ON public.tax_rates(user_id);

-- ============================================
-- ENABLE REALTIME
-- ============================================

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bills; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payments; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.products; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(invoice_number, '\D', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.invoices
  WHERE user_id = p_user_id
  AND invoice_number ~ '^\d+$';
  
  RETURN 'INV-' || LPAD(next_number::TEXT, 5, '0');
END;
$$;

-- Function to generate next bill number
CREATE OR REPLACE FUNCTION public.get_next_bill_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(bill_number, '\D', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.bills
  WHERE user_id = p_user_id
  AND bill_number ~ '^\d+$';
  
  RETURN 'BILL-' || LPAD(next_number::TEXT, 5, '0');
END;
$$;

-- Function to generate next estimate number
CREATE OR REPLACE FUNCTION public.get_next_estimate_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(estimate_number, '\D', '', 'g') AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.estimates
  WHERE user_id = p_user_id
  AND estimate_number ~ '^\d+$';
  
  RETURN 'EST-' || LPAD(next_number::TEXT, 5, '0');
END;
$$;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

