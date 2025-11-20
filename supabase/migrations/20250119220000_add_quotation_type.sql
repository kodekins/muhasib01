-- Add document type to invoices table to support quotations
-- Quotations are like invoices but don't affect accounting or balances

-- First, make invoice_number nullable since quotations won't have one
ALTER TABLE invoices 
ALTER COLUMN invoice_number DROP NOT NULL;

-- Add document_type column
ALTER TABLE invoices 
ADD COLUMN document_type VARCHAR(20) DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'quotation'));

-- Add quotation_number column (separate numbering sequence for quotations)
ALTER TABLE invoices 
ADD COLUMN quotation_number VARCHAR(50);

-- Add index for document type
CREATE INDEX idx_invoices_document_type ON invoices(document_type);

-- Add index for quotation number
CREATE INDEX idx_invoices_quotation_number ON invoices(quotation_number) WHERE quotation_number IS NOT NULL;

-- Update existing invoices to be of type 'invoice'
UPDATE invoices SET document_type = 'invoice' WHERE document_type IS NULL;

-- Add converted_to_invoice_id column (for tracking when a quotation becomes an invoice)
ALTER TABLE invoices 
ADD COLUMN converted_to_invoice_id UUID REFERENCES invoices(id);

-- Add converted_from_quotation_id column (for tracking which quotation an invoice came from)
ALTER TABLE invoices 
ADD COLUMN converted_from_quotation_id UUID REFERENCES invoices(id);

-- Comment on columns
COMMENT ON COLUMN invoices.document_type IS 'Type of document: invoice (affects accounts) or quotation (no accounting impact)';
COMMENT ON COLUMN invoices.quotation_number IS 'Unique quotation number, used when document_type is quotation';
COMMENT ON COLUMN invoices.converted_to_invoice_id IS 'Reference to invoice created from this quotation';
COMMENT ON COLUMN invoices.converted_from_quotation_id IS 'Reference to quotation this invoice was created from';

