-- Quick fix script to enable quotations
-- Run this in Supabase SQL Editor

-- Step 1: Make invoice_number nullable
ALTER TABLE invoices 
ALTER COLUMN invoice_number DROP NOT NULL;

-- Step 2: Add new columns for quotations
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) DEFAULT 'invoice' 
CHECK (document_type IN ('invoice', 'quotation'));

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(50);

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS converted_to_invoice_id UUID REFERENCES invoices(id);

ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS converted_from_quotation_id UUID REFERENCES invoices(id);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_number ON invoices(quotation_number) 
WHERE quotation_number IS NOT NULL;

-- Step 4: Update existing invoices to be of type 'invoice'
UPDATE invoices SET document_type = 'invoice' WHERE document_type IS NULL;

-- Done! You can now create quotations
SELECT 'Migration completed successfully!' as status;

