# Quotation Feature

## Overview
The system now supports **Quotations** in addition to Invoices. Quotations are sales proposals sent to customers that do NOT affect accounting, customer balances, or inventory until they are converted to invoices.

## Key Differences: Quotation vs Invoice

### Quotation
- **Document Type**: `quotation`
- **Number Format**: `QUO-00001`, `QUO-00002`, etc.
- **Purpose**: Sales proposal/estimate for customers
- **Accounting Impact**: **NONE**
  - Does NOT create journal entries
  - Does NOT update customer balances
  - Does NOT affect inventory levels
  - Does NOT record COGS (Cost of Goods Sold)
- **Status Options**: `draft`, `sent`, `viewed`, `accepted`, `declined`
- **Date Labels**: "Quotation Date" and "Valid Until"
- **Can be converted**: Yes, to an Invoice

### Invoice
- **Document Type**: `invoice`
- **Number Format**: `INV-00001`, `INV-00002`, etc.
- **Purpose**: Billing document for actual sales
- **Accounting Impact**: **FULL**
  - Creates journal entries (AR debit, Revenue credit)
  - Updates customer balances
  - Reduces inventory for products
  - Records COGS
- **Status Options**: `draft`, `sent`, `viewed`, `partial`, `paid`, `overdue`, `void`
- **Date Labels**: "Invoice Date" and "Due Date"
- **Can be created from**: Quotation

## Database Changes

### Migration: `20250119220000_add_quotation_type.sql`

Added columns to `invoices` table:
- `document_type` - Either 'invoice' or 'quotation' (default: 'invoice')
- `quotation_number` - Unique number for quotations (e.g., QUO-00001)
- `converted_to_invoice_id` - References invoice if quotation was converted
- `converted_from_quotation_id` - References quotation if invoice was created from one

### Updated Status Values
Added two new statuses for quotations:
- `accepted` - Quotation accepted by customer
- `declined` - Quotation declined by customer

## How to Use

### Creating a Quotation

1. Go to **Invoices & Quotations** section
2. Click **"New Quotation"** button (or select "Quotation" in document type)
3. Fill in customer information and line items
4. Click **"Create Quotation"**
5. The quotation is created with number `QUO-XXXXX`

### Converting a Quotation to an Invoice

1. Find the quotation in the list
2. Click the **"Convert"** button (🔄 icon)
3. A new invoice is automatically created with:
   - Fresh invoice number (`INV-XXXXX`)
   - All line items copied from quotation
   - Invoice date set to today
   - Status set to `draft`
   - Reference back to original quotation
4. The quotation status is updated to `accepted`
5. Now you can send the invoice, which WILL affect accounting

### Sending a Quotation

1. Quotations can be sent just like invoices
2. Click **"Send"** button
3. Status changes to `sent`
4. **No accounting impact** - it's just a proposal

### Viewing Invoice/Quotation Details

1. Click the eye icon (👁️) on any invoice or quotation
2. A detailed view modal opens showing:
   - Document number and status
   - Customer information
   - All line items in a table
   - Complete financial breakdown
   - Notes (if any)
   - Quick action buttons (Download PDF, Close)

### Downloading Quotations

1. Click the download icon (📥) on any quotation
2. PDF is generated with:
   - Header: "QUOTATION" (instead of "INVOICE")
   - Quotation number
   - "Valid Until" date (instead of "Due Date")
   - No "Balance Due" or "Amount Paid" sections
   - All line items and totals

## Technical Implementation

### 1. Service Layer (`src/services/invoiceService.ts`)

```typescript
// New method: Generate quotation numbers
static async getNextQuotationNumber(userId: string): Promise<string>

// New method: Convert quotation to invoice
static async convertQuotationToInvoice(quotationId: string): Promise<ServiceResponse<Invoice>>

// Updated: createInvoice - Skip accounting for quotations
// Updated: sendInvoice - Skip journal entries, COGS, and balance updates for quotations
```

### 2. PDF Service (`src/services/invoicePdfService.ts`)

- Detects document type
- Shows "QUOTATION" header for quotations
- Uses quotation_number instead of invoice_number
- Shows "Valid Until" instead of "Due Date"
- Hides payment-related fields for quotations
- Generates appropriate file names

### 3. UI Component (`src/components/invoices/InvoiceManager.tsx`)

#### New UI Elements:
- **"New Quotation" button** - Separate button for creating quotations
- **Document Type selector** - Toggle between invoice/quotation when creating
- **"Convert" button** - Appears on quotations to convert to invoice
- **Dynamic labels** - Changes based on document type
- **Status indicators** - Shows quotation-specific statuses

#### Business Logic:
- Quotations don't show payment buttons
- Quotations can be edited, sent, and downloaded
- Convert button only shows for non-converted quotations
- Proper filtering and display of both document types

### 4. TypeScript Types (`src/integrations/supabase/types.ts`)

Updated invoice table types to include:
- `document_type: 'invoice' | 'quotation'`
- `invoice_number: string | null`
- `quotation_number: string | null`
- `converted_to_invoice_id: string | null`
- `converted_from_quotation_id: string | null`
- Extended status types

## Workflow Examples

### Scenario 1: Simple Quotation → Invoice

1. **Create Quotation** (QUO-00001)
   - Customer requests quote for 10 widgets @ $50 each
   - Create quotation for $500
   - Send to customer
   - **No accounting impact**

2. **Convert to Invoice** (INV-00001)
   - Customer accepts
   - Click "Convert" button
   - Invoice created automatically
   - Status: draft

3. **Send Invoice**
   - Click "Send" on invoice
   - **Now accounting happens:**
     - Journal entry: DR Accounts Receivable $500, CR Sales Revenue $500
     - Customer balance increases by $500
     - Inventory reduced by 10 units
     - COGS recorded

### Scenario 2: Multiple Quotations

1. Create 3 quotations for same customer with different options
2. Customer chooses one (QUO-00002)
3. Convert QUO-00002 to invoice
4. Other quotations remain as reference (can be marked as declined)

## Important Notes

### ⚠️ Quotation Limitations
- **Cannot record payments** against quotations
- **Cannot be partially paid** - they're proposals, not bills
- **No aging reports** - only invoices appear in AR aging
- **No balance tracking** - quotations don't affect customer balances

### ✅ Benefits
- **Clean proposal process** - Send estimates without affecting books
- **Version control** - Keep multiple quote versions
- **Easy conversion** - One-click to create invoice from approved quote
- **Clear audit trail** - Track which invoices came from which quotations
- **Professional PDFs** - Branded quotation documents

### 🔄 Conversion Process
When converting quotation to invoice:
1. New invoice number generated
2. All line items copied exactly
3. Invoice date set to today (not quotation date)
4. Due date preserved from quotation
5. Quotation marked as "accepted"
6. Both documents linked via IDs
7. Quotation remains in system for reference

## API Methods

### Create Quotation
```typescript
const result = await InvoiceService.createInvoice({
  user_id: userId,
  customer_id: customerId,
  document_type: 'quotation',  // Key difference
  invoice_date: '2025-01-19',
  due_date: '2025-02-19',
  lines: [...],
  subtotal: 1000,
  tax_amount: 80,
  total_amount: 1080,
  balance_due: 0  // Always 0 for quotations
}, { postJournalEntry: false });  // Never post journal for quotations
```

### Convert to Invoice
```typescript
const result = await InvoiceService.convertQuotationToInvoice(quotationId);
// Returns new invoice object
```

### Send Quotation
```typescript
const result = await InvoiceService.sendInvoice(quotationId);
// No accounting impact, just status update
```

## Database Schema Reference

```sql
-- Document type differentiates invoices from quotations
ALTER TABLE invoices 
ADD COLUMN document_type VARCHAR(20) DEFAULT 'invoice' 
CHECK (document_type IN ('invoice', 'quotation'));

-- Separate numbering for quotations
ALTER TABLE invoices 
ADD COLUMN quotation_number VARCHAR(50);

-- Track conversions
ALTER TABLE invoices 
ADD COLUMN converted_to_invoice_id UUID REFERENCES invoices(id);

ALTER TABLE invoices 
ADD COLUMN converted_from_quotation_id UUID REFERENCES invoices(id);
```

## Testing Checklist

- [x] Create quotation - no accounting impact
- [x] Send quotation - no journal entries
- [x] Convert quotation to invoice
- [x] Send converted invoice - accounting happens
- [x] Download quotation PDF - shows "QUOTATION"
- [x] Download invoice PDF - shows "INVOICE"
- [x] Edit quotation in draft status
- [x] Cannot convert same quotation twice
- [x] Quotation numbering sequence separate from invoices
- [x] Both types display correctly in list
- [x] Filters work for both types
- [x] No payment buttons on quotations
- [x] Convert button only on unconverted quotations

## Migration Instructions

1. **Run Migration**:
   ```bash
   # Apply migration to add new columns
   supabase migration up
   ```

2. **Existing Data**:
   - All existing invoices automatically set to `document_type = 'invoice'`
   - No data loss or changes to existing records

3. **Build Project**:
   ```bash
   npm run build
   ```

4. **Test**:
   - Create test quotation
   - Verify no accounting impact
   - Convert to invoice
   - Verify accounting impact on invoice

## Future Enhancements (Optional)

- [ ] Email quotation directly to customers
- [ ] Quotation templates with different pricing tiers
- [ ] Track quotation acceptance rate
- [ ] Set quotation expiration with auto-status update
- [ ] Quotation comparison tool (side-by-side)
- [ ] Convert multiple quotations to single invoice
- [ ] Quotation revision history
- [ ] Custom quotation terms and conditions
- [ ] Quotation approval workflow
- [ ] Integration with CRM for quotation tracking

## Support

For issues or questions about quotations:
1. Check that migration was applied
2. Verify document_type column exists
3. Check browser console for errors
4. Review TypeScript types match database schema

