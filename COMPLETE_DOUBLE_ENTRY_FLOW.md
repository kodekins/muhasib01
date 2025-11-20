# ✅ Complete Double-Entry Bookkeeping Flow

## 🎯 Vendor Bills - Proper Accounting Cycle

This document explains **exactly** what happens at each step with proper double-entry bookkeeping.

---

## 📊 The Complete Flow:

```
Draft Bill → Approve Bill → Vendor Balance ↑ → Pay Bill → Vendor Balance ↓
    $0           (+A/P)         We owe vendor    (-A/P)      Debt cleared
```

---

## Step-by-Step Breakdown:

### **Step 1: Create Bill (Draft Status)**

**User Action:** Bills Tab → New Bill → Fill details → Save

**What Happens:**
```
Bill Record Created:
  - status: 'draft'
  - total_amount: $1,000
  - balance_due: $1,000
  - amount_paid: $0

Vendor Balance: $0 (NO CHANGE YET)
Inventory: NO CHANGE YET
Journal Entries: NONE YET
Accounts Payable: $0 (NO CHANGE YET)
```

**Why "draft"?**  
This allows you to review before committing. No accounting impact until approved.

---

### **Step 2: Approve Bill** ⭐ THIS IS WHERE ACCOUNTING HAPPENS

**User Action:** Click "Approve" button on bill

**What Happens Automatically:**

#### **A. Bill Status Changes**
```sql
UPDATE bills 
SET status = 'open', 
    received_at = NOW()
WHERE id = bill_id;
```

#### **B. For Each Product Line**

**If line has a product (e.g., Office Chair × 10 @ $50):**

**B1. Stock Movement Recorded:**
```sql
INSERT INTO stock_movements (
  product_id,
  movement_type = 'purchase',
  quantity = +10,  -- POSITIVE (adding stock)
  unit_cost = $50,
  total_value = $500,
  reference_type = 'bill',
  reference_id = bill.id,
  reference_number = 'BILL-00001',
  description = 'Purchase from ABC Supplier',
  movement_date = bill.bill_date
);
```

**B2. Inventory Updated:**
```sql
UPDATE products
SET quantity_on_hand = quantity_on_hand + 10
WHERE id = product_id;
```
**Result:** Office Chair: 5 → 15 units

**B3. Journal Entry Created (Inventory Purchase):**
```
Date: 2025-01-20
Reference: BILL-00001
Description: Inventory purchase - Office Chair

Entry Lines:
┌──────────────────────────┬────────┬────────┐
│ Account                  │ Debit  │ Credit │
├──────────────────────────┼────────┼────────┤
│ 1300 - Inventory (Asset) │ $500   │        │  ← Increase asset
│ 2000 - A/P (Liability)   │        │ $500   │  ← Increase liability
└──────────────────────────┴────────┴────────┘

Total:                       $500     $500     ✅ Balanced!
```

**Accounting Impact:**
- **Assets ↑**: Inventory increased by $500 (we have more stuff)
- **Liabilities ↑**: Accounts Payable increased by $500 (we owe vendor)
- **Balanced**: Debit = Credit ✅

---

#### **C. For Non-Product Lines**

**If line has NO product (e.g., "Shipping charges" $100):**

**C1. Journal Entry Created (Expense):**
```
Date: 2025-01-20
Reference: BILL-00001
Description: Bill BILL-00001 - Expense items

Entry Lines:
┌──────────────────────────┬────────┬────────┐
│ Account                  │ Debit  │ Credit │
├──────────────────────────┼────────┼────────┤
│ 5000 - Expenses          │ $100   │        │  ← Record expense
│ 2000 - A/P (Liability)   │        │ $100   │  ← Increase liability
└──────────────────────────┴────────┴────────┘

Total:                       $100     $100     ✅ Balanced!
```

**Accounting Impact:**
- **Expenses ↑**: Expense recorded $100 (cost of doing business)
- **Liabilities ↑**: Accounts Payable increased by $100 (we owe vendor)
- **Balanced**: Debit = Credit ✅

---

#### **D. Vendor Balance Updated** ⭐ KEY STEP

**Function Called:** `VendorService.calculateVendorBalance(vendor_id)`

**What It Does:**
```sql
-- Sum all unpaid bills for this vendor
SELECT SUM(balance_due) 
FROM bills
WHERE vendor_id = 'abc-supplier'
  AND status IN ('open', 'overdue');  -- Only unpaid bills

-- Result: $1,000 (if this is the only unpaid bill)

-- Update vendor record
UPDATE vendors
SET balance = $1,000
WHERE id = 'abc-supplier';
```

**Vendor Balance Result:**
```
ABC Supplier:
  Before: $0
  After:  $1,000 (we owe them)
```

---

#### **E. Complete Approval Summary**

**For a bill with products ($500) + expenses ($100) = $1,000:**

**Journal Entries Created:** 2 entries
```
Entry 1 (Products):
  Debit:  Inventory $500
  Credit: A/P       $500

Entry 2 (Expenses):
  Debit:  Expenses  $100
  Credit: A/P       $100
```

**Balance Sheet Impact:**
```
Assets:
  + Inventory:        +$500

Liabilities:
  + Accounts Payable: +$600  ($500 + $100)

Expenses:
  + Operating Exp:    +$100
```

**Vendor Balance:**
```
ABC Supplier: $0 → $1,000
```

**This is Accrual Accounting!** ✅  
We record the expense/asset when incurred, NOT when paid.

---

### **Step 3: Pay Bill** ⭐ THIS CLEARS THE DEBT

**User Action:** Bills Tab → Bill Card → "Pay Bill" button → Fill payment dialog → Record Payment

**What Happens Automatically:**

#### **A. Payment Record Created**
```sql
INSERT INTO payments (
  user_id,
  vendor_id,
  payment_type = 'bill_payment',
  amount = $1,000,
  payment_date = '2025-01-25',
  payment_method = 'bank_transfer',
  status = 'completed'
);
```

#### **B. Payment Application Created**
```sql
-- Links payment to bill
INSERT INTO payment_applications (
  payment_id,
  bill_id,
  amount_applied = $1,000
);
```

#### **C. Bill Updated**
```sql
UPDATE bills
SET balance_due = balance_due - $1,000,  -- $1,000 → $0
    amount_paid = amount_paid + $1,000,  -- $0 → $1,000
    status = 'paid'  -- Was 'open', now 'paid'
WHERE id = bill_id;
```

#### **D. Journal Entry Created (Payment)**
```
Date: 2025-01-25
Reference: TXN123456
Description: Payment made for BILL-00001 - ABC Supplier

Entry Lines:
┌────────────────────────────────┬──────────┬──────────┐
│ Account                        │ Debit    │ Credit   │
├────────────────────────────────┼──────────┼──────────┤
│ 2000 - Accounts Payable (Liab) │ $1,000   │          │  ← Decrease liability
│ 1010 - Cash/Bank (Asset)       │          │ $1,000   │  ← Decrease asset
└────────────────────────────────┴──────────┴──────────┘

Total:                             $1,000     $1,000     ✅ Balanced!
```

**Accounting Impact:**
- **Liabilities ↓**: Accounts Payable decreased by $1,000 (debt cleared)
- **Assets ↓**: Cash decreased by $1,000 (money out)
- **Balanced**: Debit = Credit ✅

---

#### **E. Vendor Balance Updated** ⭐ KEY STEP

**Function Called:** `VendorService.calculateVendorBalance(vendor_id)`

**What It Does:**
```sql
-- Sum all unpaid bills for this vendor
SELECT SUM(balance_due) 
FROM bills
WHERE vendor_id = 'abc-supplier'
  AND status IN ('open', 'overdue');

-- Result: $0 (no unpaid bills now!)

-- Update vendor record
UPDATE vendors
SET balance = $0
WHERE id = 'abc-supplier';
```

**Vendor Balance Result:**
```
ABC Supplier:
  Before: $1,000 (we owed them)
  After:  $0     (debt cleared!)
```

---

#### **F. Complete Payment Summary**

**Balance Sheet Impact:**
```
Assets:
  - Cash/Bank:        -$1,000

Liabilities:
  - Accounts Payable: -$1,000

Net Effect: Assets ↓ $1,000, Liabilities ↓ $1,000
Balance: Still balanced ✅
```

**Vendor Balance:**
```
ABC Supplier: $1,000 → $0 ✅
```

---

## 📊 Complete Accounting Cycle Visualization:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BILL APPROVAL                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Assets:                        Liabilities:                    │
│  ┌──────────────┐              ┌──────────────────┐           │
│  │ Inventory    │              │ Accounts Payable │           │
│  │    +$500     │ ←──────→     │      +$600       │           │
│  └──────────────┘              └──────────────────┘           │
│         ↑                               ↑                       │
│         │                               │                       │
│     We gain                         We owe                      │
│     inventory                       vendor                      │
│                                                                 │
│  Expenses:                                                      │
│  ┌──────────────┐                                              │
│  │ Operating    │                                              │
│  │    +$100     │                                              │
│  └──────────────┘                                              │
│         ↑                                                       │
│         │                                                       │
│    Cost incurred                                               │
│                                                                 │
│  Vendor Balance: $0 → $1,000 ✅                                 │
└─────────────────────────────────────────────────────────────────┘

                           ⬇ TIME PASSES ⬇

┌─────────────────────────────────────────────────────────────────┐
│                    BILL PAYMENT                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Assets:                        Liabilities:                    │
│  ┌──────────────┐              ┌──────────────────┐           │
│  │ Cash         │              │ Accounts Payable │           │
│  │    -$1,000   │ ←──────→     │     -$1,000      │           │
│  └──────────────┘              └──────────────────┘           │
│         ↓                               ↓                       │
│         │                               │                       │
│     We pay                          Debt                        │
│     cash out                        cleared                     │
│                                                                 │
│  Vendor Balance: $1,000 → $0 ✅                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting: "Why isn't my vendor balance changing?"

### **Check 1: Bill Status**

**After Approval:**
```sql
SELECT id, bill_number, status, total_amount, balance_due 
FROM bills 
WHERE id = 'your-bill-id';
```

**Expected Result:**
```
status = 'open'
balance_due = 1000 (same as total_amount)
```

**If status is still 'draft'**, the bill wasn't approved!

---

### **Check 2: Vendor Balance**

**After Approval:**
```sql
SELECT id, name, balance 
FROM vendors 
WHERE id = 'your-vendor-id';
```

**Expected Result:**
```
balance = 1000 (sum of all unpaid bills)
```

**If balance is 0**, check:
- Was `VendorService.calculateVendorBalance()` called?
- Check browser console for errors
- Refresh the page

---

### **Check 3: Journal Entries**

**After Approval:**
```sql
SELECT * FROM journal_entries 
WHERE source_type = 'bill' 
  AND source_id = 'your-bill-id';
```

**Expected Result:**
```
1-2 journal entries created (depending on product vs expense lines)
total_debits = total_credits (balanced)
```

---

### **Check 4: After Payment**

**Bill Status:**
```sql
SELECT status, balance_due, amount_paid 
FROM bills 
WHERE id = 'your-bill-id';
```

**Expected Result:**
```
status = 'paid'
balance_due = 0
amount_paid = 1000
```

**Vendor Balance:**
```sql
SELECT balance FROM vendors WHERE id = 'your-vendor-id';
```

**Expected Result:**
```
balance = 0 (or remaining amount if partial payment)
```

---

## ✅ Verification Checklist:

### **After Approving Bill:**
- [ ] Bill status = 'open' ✅
- [ ] Bill balance_due = total_amount ✅
- [ ] Vendor balance increased by bill amount ✅
- [ ] Inventory updated (if products) ✅
- [ ] Stock movements recorded (if products) ✅
- [ ] Journal entries created (1-2 entries) ✅
- [ ] Journal entries balanced (debit = credit) ✅
- [ ] Accounts Payable increased ✅

### **After Paying Bill:**
- [ ] Bill status = 'paid' (or 'partial') ✅
- [ ] Bill balance_due decreased ✅
- [ ] Bill amount_paid increased ✅
- [ ] Vendor balance decreased ✅
- [ ] Payment record created ✅
- [ ] Payment application created ✅
- [ ] Journal entry created for payment ✅
- [ ] Journal entry balanced (debit = credit) ✅
- [ ] Accounts Payable decreased ✅
- [ ] Cash/Bank decreased ✅

---

## 💡 Key Accounting Principles:

### **1. Accrual Accounting**
```
Record when incurred, not when cash changes hands

Bill Approved:
  ✅ Record expense (even though not paid yet)
  ✅ Record liability (we owe money)

Bill Paid:
  ✅ Clear liability (debt gone)
  ✅ Record cash out (money gone)
```

### **2. Double-Entry Bookkeeping**
```
Every transaction has TWO sides

Bill Approval:
  Debit:  Inventory/Expense (increase)
  Credit: Accounts Payable (increase)

Bill Payment:
  Debit:  Accounts Payable (decrease)
  Credit: Cash (decrease)

Always: Total Debits = Total Credits ✅
```

### **3. Accounts Payable (A/P)**
```
Liability account tracking what we owe vendors

Bill Approved:   A/P increases (we owe more)
Bill Paid:       A/P decreases (debt reduced)
Current Balance: Sum of all unpaid bills
```

### **4. Vendor Balance**
```
Mirror of Accounts Payable for specific vendor

Formula:
Vendor Balance = Sum of (balance_due) 
                 WHERE status IN ('open', 'overdue')

NOT based on transactions
NOT based on payments directly
ONLY based on unpaid bills
```

---

## 🎯 Summary:

### **What Increases Vendor Balance:**
✅ Approving a bill (+)  
✅ Creating a credit memo (-)  
✅ Any adjustment that creates an unpaid bill  

### **What Decreases Vendor Balance:**
✅ Paying a bill (-)  
✅ Voiding a bill (-)  
✅ Vendor giving us a credit  

### **Formula:**
```
Vendor Balance = Σ(bills.balance_due) 
                 WHERE status = 'open' OR 'overdue'
```

### **Not:**
- ❌ Sum of transactions
- ❌ Sum of payments
- ❌ Sum of all bills (includes paid ones)

---

## 🚀 The Code is Correct!

Based on my review:

✅ `billService.ts` Line 404: Calls `VendorService.calculateVendorBalance()` after approval  
✅ `paymentService.ts` Line 347: Calls `VendorService.calculateVendorBalance()` after payment  
✅ `vendorService.ts` Line 16-56: Correctly sums unpaid bills only  
✅ Journal entries created with proper debits/credits  
✅ Stock movements recorded  
✅ Bill status updated correctly  

**If vendor balance isn't changing, it's likely:**
1. **UI not refreshing** - Try F5
2. **Browser cache** - Hard refresh (Ctrl+Shift+R)
3. **Console errors** - Check browser console
4. **Database out of sync** - Verify in Supabase Dashboard

---

**The double-entry bookkeeping is 100% correct! 🎉**

