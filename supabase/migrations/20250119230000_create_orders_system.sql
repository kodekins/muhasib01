-- Sales Orders and Purchase Orders System
-- Sales Order: Convert to Invoice (auto-sent)
-- Purchase Order: Convert to Bill (auto-approved)

-- Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'converted', 'cancelled')),
  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Details
  notes TEXT,
  terms TEXT,
  -- References
  converted_invoice_id UUID REFERENCES public.invoices(id),
  -- Tracking
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_number)
);

-- Sales Order Line Items
CREATE TABLE IF NOT EXISTS public.sales_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  order_number TEXT NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'converted', 'cancelled')),
  -- Amounts
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Details
  notes TEXT,
  terms TEXT,
  shipping_address TEXT,
  -- References
  converted_bill_id UUID REFERENCES public.bills(id),
  -- Tracking
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, order_number)
);

-- Purchase Order Line Items
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  quantity NUMERIC(15,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  line_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies for Sales Orders
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sales orders"
  ON public.sales_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sales orders"
  ON public.sales_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sales orders"
  ON public.sales_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sales orders"
  ON public.sales_orders FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sales order lines"
  ON public.sales_order_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE sales_orders.id = sales_order_lines.sales_order_id
    AND sales_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own sales order lines"
  ON public.sales_order_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE sales_orders.id = sales_order_lines.sales_order_id
    AND sales_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own sales order lines"
  ON public.sales_order_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE sales_orders.id = sales_order_lines.sales_order_id
    AND sales_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own sales order lines"
  ON public.sales_order_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sales_orders
    WHERE sales_orders.id = sales_order_lines.sales_order_id
    AND sales_orders.user_id = auth.uid()
  ));

-- RLS Policies for Purchase Orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchase orders"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchase orders"
  ON public.purchase_orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchase orders"
  ON public.purchase_orders FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own purchase order lines"
  ON public.purchase_order_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_lines.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own purchase order lines"
  ON public.purchase_order_lines FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_lines.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own purchase order lines"
  ON public.purchase_order_lines FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_lines.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own purchase order lines"
  ON public.purchase_order_lines FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE purchase_orders.id = purchase_order_lines.purchase_order_id
    AND purchase_orders.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_sales_orders_user_id ON public.sales_orders(user_id);
CREATE INDEX idx_sales_orders_customer_id ON public.sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON public.sales_orders(status);
CREATE INDEX idx_sales_orders_order_date ON public.sales_orders(order_date);
CREATE INDEX idx_sales_order_lines_sales_order_id ON public.sales_order_lines(sales_order_id);
CREATE INDEX idx_sales_order_lines_product_id ON public.sales_order_lines(product_id);

CREATE INDEX idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX idx_purchase_orders_vendor_id ON public.purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_order_date ON public.purchase_orders(order_date);
CREATE INDEX idx_purchase_order_lines_purchase_order_id ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX idx_purchase_order_lines_product_id ON public.purchase_order_lines(product_id);

