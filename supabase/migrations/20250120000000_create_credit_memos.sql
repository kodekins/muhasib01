-- Credit Memos System
-- ALL BUSINESS LOGIC IN APPLICATION CODE (services/creditMemoService.ts)
-- NO TRIGGERS OR FUNCTIONS

-- ============================================
-- 1. CREDIT MEMOS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.credit_memos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  credit_memo_number TEXT NOT NULL,
  credit_memo_date DATE NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'void')),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  issued_at TIMESTAMP WITH TIME ZONE,
  voided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, credit_memo_number)
);

-- ============================================
-- 2. CREDIT MEMO LINES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.credit_memo_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_memo_id UUID NOT NULL REFERENCES public.credit_memos(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_credit_memos_user_id ON public.credit_memos(user_id);
CREATE INDEX idx_credit_memos_customer_id ON public.credit_memos(customer_id);
CREATE INDEX idx_credit_memos_invoice_id ON public.credit_memos(invoice_id);
CREATE INDEX idx_credit_memos_status ON public.credit_memos(status);
CREATE INDEX idx_credit_memos_date ON public.credit_memos(credit_memo_date);
CREATE INDEX idx_credit_memo_lines_credit_memo_id ON public.credit_memo_lines(credit_memo_id);
CREATE INDEX idx_credit_memo_lines_product_id ON public.credit_memo_lines(product_id);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.credit_memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_memo_lines ENABLE ROW LEVEL SECURITY;

-- Credit Memos Policies
CREATE POLICY "Users can view their own credit memos"
  ON public.credit_memos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit memos"
  ON public.credit_memos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit memos"
  ON public.credit_memos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credit memos"
  ON public.credit_memos FOR DELETE
  USING (auth.uid() = user_id);

-- Credit Memo Lines Policies
CREATE POLICY "Users can view credit memo lines for their credit memos"
  ON public.credit_memo_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_memos
      WHERE credit_memos.id = credit_memo_lines.credit_memo_id
      AND credit_memos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert credit memo lines for their credit memos"
  ON public.credit_memo_lines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_memos
      WHERE credit_memos.id = credit_memo_lines.credit_memo_id
      AND credit_memos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update credit memo lines for their credit memos"
  ON public.credit_memo_lines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_memos
      WHERE credit_memos.id = credit_memo_lines.credit_memo_id
      AND credit_memos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete credit memo lines for their credit memos"
  ON public.credit_memo_lines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_memos
      WHERE credit_memos.id = credit_memo_lines.credit_memo_id
      AND credit_memos.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE public.credit_memos IS 'Customer credit memos for refunds, returns, and invoice corrections. All business logic in application code.';
COMMENT ON TABLE public.credit_memo_lines IS 'Line items for credit memos';

COMMENT ON COLUMN public.credit_memos.status IS 'draft: editable, issued: finalized with journal entries, void: cancelled';
COMMENT ON COLUMN public.credit_memos.reason IS 'Reason for credit memo (e.g., Product Return, Billing Error, Customer Adjustment)';
COMMENT ON COLUMN public.credit_memos.journal_entry_id IS 'Link to the journal entry created when credit memo is issued';

