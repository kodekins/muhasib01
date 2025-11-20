-- Add unit_of_measure column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'unit';

-- Add comment
COMMENT ON COLUMN public.products.unit_of_measure IS 'Unit of measurement (unit, kg, lbs, box, case, etc.)';

