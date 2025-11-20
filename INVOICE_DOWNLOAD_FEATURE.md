# Invoice & Quotation Download Feature

## Overview
Both Invoices and Quotations can now be downloaded as professionally formatted PDF files.

## What Was Implemented

### 1. PDF Generation Service
- **File**: `src/services/invoicePdfService.ts`
- Generates professional PDF invoices using `jspdf` and `jspdf-autotable`
- Includes all invoice details:
  - Invoice number, dates, and status
  - Customer billing information
  - Itemized line items with quantities, prices, and discounts
  - Subtotal, tax, discounts, and total
  - Amount paid and balance due (if applicable)
  - Notes section
  - Generated timestamp footer

### 2. UI Integration
- **File**: `src/components/invoices/InvoiceManager.tsx`
- Added download button (download icon) for each invoice
- Button appears for all invoices regardless of status
- Located at the left of the action buttons for easy access

### 3. Dependencies Added
- `jspdf` - Core PDF generation library
- `jspdf-autotable` - Table generation plugin for jsPDF

## How to Use

### For Users:
1. Navigate to the Invoices section
2. Find the invoice you want to download
3. Click the download icon button (📥) on the invoice row
4. The PDF will automatically download to your default downloads folder
5. File naming format: `Invoice_[INVOICE_NUMBER]_[CUSTOMER_NAME].pdf`

### For Developers:
```typescript
// Import the service
import { InvoicePdfService } from '@/services/invoicePdfService';

// Generate and download PDF
await InvoicePdfService.generateInvoicePDF(invoiceWithLinesData);

// For preview (opens in new tab instead of downloading):
await InvoicePdfService.previewInvoicePDF(invoiceWithLinesData);
```

## Features

### PDF Content Includes:
- **Header**: "INVOICE" title with invoice number and status
- **Dates**: Invoice date and due date
- **Customer Information**: 
  - Company name (if available)
  - Contact name
  - Email and phone
  - Address
- **Line Items Table**:
  - Description
  - Quantity
  - Unit price
  - Discount percentage
  - Line total
- **Financial Summary**:
  - Subtotal
  - Tax amount
  - Discount amount (if any)
  - Total amount
  - Amount paid (if any)
  - Balance due (highlighted in red if unpaid)
- **Notes**: Customer-facing notes
- **Footer**: Generation timestamp

### Status Color Coding:
- Draft: Gray
- Sent/Viewed: Blue
- Partial: Yellow/Gold
- Paid: Green
- Overdue: Red
- Void: Light Gray

## Technical Details

### Type Safety
- Created custom TypeScript declarations for jsPDF extensions
- All invoice data is properly typed using `InvoiceWithLines` interface

### Error Handling
- Graceful error handling with user-friendly toast notifications
- Console logging for debugging

### Data Fetching
- Fetches complete invoice data including:
  - Invoice details
  - All line items
  - Customer information
- Uses Supabase query with proper joins

## Future Enhancements (Optional)
- Preview before download
- Email invoice directly from the app
- Customizable invoice templates
- Company logo and branding
- Multiple currency support
- Batch download multiple invoices
- Print directly without downloading
- Custom PDF styling/themes

## Testing Checklist
- [x] Build completes without errors
- [ ] Download button appears on all invoices
- [ ] PDF generates with correct data
- [ ] PDF formatting is professional and readable
- [ ] All invoice statuses display correctly
- [ ] Customer information appears correctly
- [ ] Line items table displays properly
- [ ] Financial calculations are accurate
- [ ] File downloads with correct naming

## Notes
- PDFs are generated client-side using jsPDF
- No server-side processing required
- Works offline once the app is loaded
- Optimized for standard A4/Letter paper sizes

