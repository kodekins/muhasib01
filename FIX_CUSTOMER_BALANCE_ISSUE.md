# 🔧 Fix Customer Balance Issue

## Problem
Customer shows $0.00 balance even though they have outstanding invoices.

## Root Cause
Some invoices have `balance_due` incorrectly set to `0` instead of the actual outstanding amount (`total_amount - amount_paid`).

---

## ✅ Solution (2 Steps)

### **Step 1: Run SQL Migration (REQUIRED)**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and run this file:
   ```
   supabase/migrations/20250119240000_fix_invoice_balance_due.sql
   ```
3. Click "Run"
4. This will automatically fix all existing invoices ✅

**What it does:**
- Updates `balance_due` for all invoices where it's incorrectly set to 0
- Ensures `balance_due = total_amount - amount_paid` for all invoices
- Skips quotations (they should have balance_due = 0)
- Skips void/cancelled invoices

---

### **Step 2: Refresh Customer Balances**

After running the migration, refresh your browser and the customer balance should now show correctly!

**The system will now:**
- ✅ Automatically set correct `balance_due` when sending invoices
- ✅ Calculate customer balance from invoice `balance_due`
- ✅ Update customer balance after payments

---

## 🔍 What Was Fixed:

### **Code Changes:**

**1. Updated `InvoiceService.sendInvoice()` function:**
```typescript
// Now explicitly sets balance_due when sending invoice
updateData.balance_due = invoice.total_amount - (invoice.amount_paid || 0);
```

**2. Added `InvoiceService.recalculateAllBalances()` function:**
- Utility function to recalculate all invoice balances if needed
- Can be called from browser console if issues persist

**3. SQL Migration:**
- Fixes all existing invoices with incorrect balance_due

---

## 🧪 Testing:

After running the migration:

1. **Check Hussain's Balance:**
   - Should show: **$500.00** (not $0.00 credit)
   
2. **Check Invoice INV-00006:**
   - Total: $500.00
   - Status: sent
   - Balance Due: $500.00 ✅

3. **Create New Invoice:**
   - Create → Send → Check customer balance updates correctly

4. **Record Payment:**
   - Pay the invoice → Balance should reduce correctly

---

## 🆘 If Issue Persists:

If customer balance still shows $0.00 after running the migration:

**Option 1: Browser Console (Quick Fix)**
```javascript
// Open browser console (F12) and run:
const { InvoiceService, CustomerService } = await import('./src/services');
const { data: userData } = await supabase.auth.getUser();

// Recalculate all invoice balances
await InvoiceService.recalculateAllBalances(userData.user.id);

// Recalculate all customer balances
await CustomerService.recalculateAllCustomerBalances(userData.user.id);

// Then refresh the page
```

**Option 2: Check Invoice in Database**
```sql
-- In Supabase SQL Editor:
SELECT 
  invoice_number,
  customer_id,
  status,
  total_amount,
  amount_paid,
  balance_due,
  document_type
FROM invoices
WHERE invoice_number = 'INV-00006';

-- If balance_due is still 0, manually fix:
UPDATE invoices 
SET balance_due = total_amount - amount_paid 
WHERE invoice_number = 'INV-00006';
```

---

## 🎯 Prevention:

This issue is now prevented by:
1. ✅ `sendInvoice()` always sets correct balance_due
2. ✅ `createInvoice()` sets initial balance_due = total_amount
3. ✅ `recordInvoicePayment()` updates balance_due correctly
4. ✅ `calculateCustomerBalance()` sums from invoice balance_due

---

## 📊 Expected Results After Fix:

**Before:**
```
Customer: Hussain
Balance: $0.00 credit ❌
```

**After:**
```
Customer: Hussain
Balance: $500.00 owed ✅
```

---

## 🚀 Ready to Fix!

1. Run the SQL migration
2. Refresh browser
3. Check customer balance
4. Done! ✅

**The issue should be resolved immediately after running the migration.**

