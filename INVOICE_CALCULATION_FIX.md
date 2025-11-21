# ✅ Invoice Calculation Fixed - Now Matches Sales Order Logic

## 🎯 Summary

Fixed invoice tax and discount calculations to work **exactly** like sales orders. Removed invoice-level discount and tax fields, keeping only line-level calculations for consistency.

---

## 📋 Changes Made

### 1. **InvoiceManager.tsx** (UI Component)

#### ✅ Updated State
- **Removed** `tax_rate` from `newInvoice` state
- **Removed** `discount_amount` from `newInvoice` state
- Now only stores: `customer_id`, `invoice_date`, `due_date`, `notes`

#### ✅ Updated Line Calculation Functions

**`selectProduct()` - Lines 188-214**
```typescript
// OLD: Only applied discount, ignored tax
const lineAmount = newLines[index].quantity * newLines[index].unit_price;
const discountAmount = lineAmount * ((newLines[index].discount_percent || 0) / 100);
newLines[index].amount = lineAmount - discountAmount;

// NEW: Applies discount THEN tax (same as sales order)
const qty = newLines[index].quantity;
const price = newLines[index].unit_price;
const discount = newLines[index].discount_percent || 0;
const tax = newLines[index].tax_rate || 0;

const subtotal = qty * price;
const discountAmount = subtotal * (discount / 100);
const taxableAmount = subtotal - discountAmount;
const taxAmount = taxableAmount * (tax / 100);

newLines[index].amount = taxableAmount + taxAmount; // Includes tax
```

**`updateLine()` - Lines 218-243**
- Now recalculates when `tax_rate` changes (added to condition)
- Same calculation logic as `selectProduct()` and sales orders

#### ✅ Updated Total Calculation Functions

**`calculateSubtotal()` - Lines 245-256**
```typescript
// Subtotal = sum of taxable amounts (after line discounts, before tax)
return lines.reduce((sum, line) => {
  const qty = line.quantity;
  const price = line.unit_price;
  const discount = line.discount_percent || 0;
  
  const subtotal = qty * price;
  const discountAmount = subtotal * (discount / 100);
  const taxableAmount = subtotal - discountAmount;
  
  return sum + taxableAmount;
}, 0);
```

**`calculateTax()` - Lines 258-273**
```typescript
// Tax = sum of all line-level taxes
return lines.reduce((sum, line) => {
  const qty = line.quantity;
  const price = line.unit_price;
  const discount = line.discount_percent || 0;
  const tax = line.tax_rate || 0;
  
  const subtotal = qty * price;
  const discountAmount = subtotal * (discount / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (tax / 100);
  
  return sum + taxAmount;
}, 0);
```

**`calculateTotal()` - Lines 275-278**
```typescript
// Total = sum of line amounts (which already include tax)
return lines.reduce((sum, line) => sum + line.amount, 0);
```

#### ✅ Updated Invoice Creation/Update
- Set `discount_amount: 0` (no invoice-level discount)
- Removed references to `newInvoice.tax_rate`
- Removed references to `newInvoice.discount_amount`

#### ✅ Updated UI (Removed Fields)
- **Removed** "Tax Rate (%)" input field
- **Removed** "Invoice Discount ($)" input field
- **Updated** totals display to show only:
  - Subtotal (taxable amount after line discounts)
  - Tax (sum of line taxes)
  - Total (subtotal + tax)
- Added helper text: "Tax and discount are applied at line level"

#### ✅ Updated Helper Functions
- `resetForm()` - Removed tax_rate and discount_amount initialization
- `openEditInvoice()` - Removed tax_rate and discount_amount calculation

---

### 2. **InvoiceService.ts** (Business Logic)

#### ✅ Updated calculateTotals Method
```typescript
// OLD signature
static calculateTotals(lines: InvoiceLine[], discountAmount: number = 0)

// NEW signature (removed discountAmount parameter)
static calculateTotals(lines: InvoiceLine[])
```

**Changes:**
- Removed `discountAmount` parameter (no longer needed)
- Updated formula: `total_amount = subtotal + tax_amount` (was: `... - discountAmount`)
- Updated all calls to `calculateTotals()` to remove second parameter

---

### 3. **AI Accountant** (supabase/functions/ai-accountant/index.ts)

#### ✅ Updated CREATE_INVOICE Action (Lines 1148-1227)

**Old Calculation:**
```typescript
const subtotal = data.subtotal || data.lines.reduce((sum, line) => sum + line.amount, 0);
const tax_amount = data.tax_amount || 0;
const discount_amount = data.discount_amount || 0;
const total_amount = subtotal + tax_amount - discount_amount;
```

**New Calculation (Same as Sales Order):**
```typescript
// Calculate subtotal (taxable amount after line discounts)
const subtotal = data.lines.reduce((sum: number, line: any) => {
  const qty = line.quantity || 1;
  const price = line.unit_price;
  const discount = line.discount_percent || 0;
  
  const lineSubtotal = qty * price;
  const discountAmount = lineSubtotal * (discount / 100);
  const taxableAmount = lineSubtotal - discountAmount;
  
  return sum + taxableAmount;
}, 0);

// Calculate tax (sum of line taxes)
const tax_amount = data.lines.reduce((sum: number, line: any) => {
  const qty = line.quantity || 1;
  const price = line.unit_price;
  const discount = line.discount_percent || 0;
  const tax = line.tax_rate || 0;
  
  const lineSubtotal = qty * price;
  const discountAmount = lineSubtotal * (discount / 100);
  const taxableAmount = lineSubtotal - discountAmount;
  const lineTax = taxableAmount * (tax / 100);
  
  return sum + lineTax;
}, 0);

const discount_amount = 0; // No invoice-level discount
const total_amount = subtotal + tax_amount;
```

**Updated Line Creation:**
```typescript
// Now calculates amount for each line including tax
const lines = data.lines.map((line: any, index: number) => {
  const qty = line.quantity || 1;
  const price = line.unit_price;
  const discount = line.discount_percent || 0;
  const tax = line.tax_rate || 0;
  
  const lineSubtotal = qty * price;
  const discountAmount = lineSubtotal * (discount / 100);
  const taxableAmount = lineSubtotal - discountAmount;
  const lineTax = taxableAmount * (tax / 100);
  const amount = taxableAmount + lineTax;
  
  return {
    invoice_id: invoice.id,
    description: line.description,
    quantity: qty,
    unit_price: price,
    discount_percent: discount,
    tax_rate: tax,
    amount: amount, // Includes tax
    account_id: line.account_id,
    line_order: index
  };
});
```

#### ✅ Updated EDIT_INVOICE Action (Lines 1246-1364)
- Applied same calculation logic as CREATE_INVOICE
- Updated line creation with same formula
- Set `discount_amount: 0`

---

## 📊 Calculation Formula (Now Consistent Across All Systems)

### Line-Level Calculation
```
Line Subtotal = Quantity × Unit Price
Line Discount Amount = Line Subtotal × (Discount % ÷ 100)
Taxable Amount = Line Subtotal - Line Discount Amount
Line Tax Amount = Taxable Amount × (Tax Rate % ÷ 100)
Line Total = Taxable Amount + Line Tax Amount
```

### Invoice-Level Calculation
```
Invoice Subtotal = Sum of all (Taxable Amounts)
Invoice Tax = Sum of all (Line Tax Amounts)
Invoice Total = Invoice Subtotal + Invoice Tax
```

### Example
```
Line 1: 10 items × $100 = $1,000
  - 10% discount = $100 discount
  - Taxable: $900
  - 8% tax = $72
  - Line total: $972

Line 2: 5 items × $50 = $250
  - 0% discount
  - Taxable: $250
  - 5% tax = $12.50
  - Line total: $262.50

Invoice:
  - Subtotal: $1,150.00 (taxable amounts)
  - Tax: $84.50
  - Total: $1,234.50
```

---

## ✅ Benefits

1. **Consistency**: Invoice calculations now match sales orders exactly
2. **Accurate Conversion**: Sales orders convert to invoices with 100% accuracy
3. **Line-Level Control**: Different tax rates and discounts per line item
4. **Proper Tax Flow**: Tax calculated after discount (legally correct)
5. **AI Compatible**: AI accountant creates invoices with correct calculations
6. **Simpler UI**: Removed confusing invoice-level fields

---

## 🧪 What to Test

1. **Create Invoice**: Add lines with different tax rates and discounts
2. **Edit Invoice**: Modify line quantities, prices, discounts, tax rates
3. **Convert Sales Order**: Verify amounts match exactly
4. **AI Accountant**: Create invoice via chat and verify calculations
5. **Send Invoice**: Ensure journal entries use correct amounts
6. **Invoice PDF**: Check that totals display correctly

---

## 🔄 Migration Notes

### Existing Invoices
- Existing invoices with invoice-level discount/tax will continue to work
- When editing old invoices, they'll be recalculated with new logic
- No database migration needed (fields still exist, just set to 0)

### Database Schema
- No changes required to database structure
- `discount_amount` column still exists but always set to 0
- Line-level `tax_rate` and `discount_percent` columns were already present

---

## 📝 Files Modified

1. ✅ `src/components/invoices/InvoiceManager.tsx`
2. ✅ `src/services/invoiceService.ts`
3. ✅ `supabase/functions/ai-accountant/index.ts`

---

## ✨ Result

**Before Fix:**
- ❌ Mixed tax calculation (line-level field but invoice-level calculation)
- ❌ Invoice-level discount and tax rate fields
- ❌ Inconsistent with sales orders
- ❌ Line amount didn't include tax

**After Fix:**
- ✅ Pure line-level tax and discount
- ✅ No invoice-level discount or tax fields
- ✅ Identical to sales order logic
- ✅ Line amount includes tax
- ✅ Clean, consistent calculation across all systems

---

**Status**: ✅ Complete - Invoice calculations now fully consistent with sales orders!

