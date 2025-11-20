-- Create stock_movements table for tracking inventory movements with proper bookkeeping
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return')),
  quantity NUMERIC(15,4) NOT NULL, -- Positive for increases, negative for decreases
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  reference_type TEXT, -- 'invoice', 'bill', 'adjustment', etc.
  reference_id UUID,
  reference_number TEXT,
  description TEXT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_user 
  ON public.stock_movements(user_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product 
  ON public.stock_movements(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type 
  ON public.stock_movements(movement_type);

CREATE INDEX IF NOT EXISTS idx_stock_movements_date 
  ON public.stock_movements(movement_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
  ON public.stock_movements(reference_type, reference_id);

-- Enable Row Level Security
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_movements
CREATE POLICY "Users can view their own stock movements"
  ON public.stock_movements
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stock movements"
  ON public.stock_movements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock movements"
  ON public.stock_movements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stock movements"
  ON public.stock_movements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE public.stock_movements IS 'Tracks all inventory movements with proper double-entry bookkeeping support';
COMMENT ON COLUMN public.stock_movements.movement_type IS 'Type of movement: sale (decrease), purchase (increase), adjustment (manual), return (increase)';
COMMENT ON COLUMN public.stock_movements.quantity IS 'Quantity moved - positive for increases (purchase, return), negative for decreases (sale, wastage)';
COMMENT ON COLUMN public.stock_movements.total_value IS 'Total value of movement (quantity × unit_cost)';
COMMENT ON COLUMN public.stock_movements.reference_type IS 'Type of source document: invoice, bill, adjustment, etc.';
COMMENT ON COLUMN public.stock_movements.reference_id IS 'ID of the source document';
COMMENT ON COLUMN public.stock_movements.reference_number IS 'Human-readable reference number (INV-001, BILL-001, etc.)';

