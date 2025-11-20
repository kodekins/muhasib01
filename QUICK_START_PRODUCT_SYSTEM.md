# 🚀 Quick Start: Complete Product System

## ⚡ Step 1: Run Database Migrations

Go to: https://supabase.com/dashboard/project/oboknyalxbdioqgnzhrs/editor

**Run these two SQL commands:**

### Migration 1: Stock Movements Table
```sql
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment', 'return')),
  quantity NUMERIC(15,4) NOT NULL,
  unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  reference_number TEXT,
  description TEXT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_user ON public.stock_movements(user_id);
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_stock_movements_type ON public.stock_movements(movement_type);
CREATE INDEX idx_stock_movements_date ON public.stock_movements(movement_date DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stock movements"
  ON public.stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own stock movements"
  ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stock movements"
  ON public.stock_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stock movements"
  ON public.stock_movements FOR DELETE USING (auth.uid() = user_id);
```

### Migration 2: Add Unit of Measure
```sql
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'unit';
```

---

## ⚡ Step 2: Create a Vendor

1. Go to **Vendors** tab
2. Click **New Vendor**
3. Fill in:
   - Name: "ABC Office Supplies"
   - Email: vendor@abc.com
   - Phone: (555) 123-4567
4. Save

---

## ⚡ Step 3: Create Product with Initial Purchase

1. Go to **Products** tab
2. Click **New Product**
3. Fill in:
   - **Name:** Office Chair
   - **SKU:** CHAIR-001
   - **Type:** Product (Inventory)
   - **Unit Price:** 100
   - **Cost:** 50
   
4. Scroll to **Initial Purchase** section:
   - **Initial Quantity:** 20
   - **Vendor:** ABC Office Supplies
   - **Purchase Date:** (today)

5. See **Accounting Preview:**
   - Creates stock movement
   - Updates vendor balance: +$1,000
   - Creates journal entry

6. Click **Create Product**

---

## ⚡ Step 4: Check What Happened

### **View Summary Cards** (at top)
- Total Products: 1
- Inventory Value: $1,000
- Low Stock: 0
- Out of Stock: 0

### **Click "Stock Movements" Tab**
You'll see:
```
Date       | Product      | Type     | Qty | Reference      | Notes
2025-01-19 | Office Chair | purchase | +20 | INITIAL-CHAIR  | Initial purchase...
```

### **Check Vendor Balance**
Go to **Vendors** tab → ABC Office Supplies  
Balance: **$1,000** (you owe them)

### **Check Journal Entries**
Go to **Journal** tab  
Latest entry:
- **Debit:** Inventory $1,000
- **Credit:** Accounts Payable $1,000

---

## ⚡ Step 5: Sell the Product

1. Go to **Invoices** tab
2. Click **New Invoice**
3. Select customer (or create new)
4. Add line item:
   - Product: Office Chair
   - Quantity: 5
   - Price: $100
5. Click **Send Invoice**

---

## ⚡ Step 6: Check Stock Movement

1. Go back to **Products** tab
2. See summary cards:
   - Inventory Value: now **$750** (15 × $50)
3. Click **Stock Movements** tab

You'll see TWO movements:
```
Date       | Product      | Type     | Qty | Reference  | Notes
2025-01-19 | Office Chair | sale     | -5  | INV-00001  | Sold to [Customer]
2025-01-19 | Office Chair | purchase | +20 | INITIAL    | Initial purchase
```

4. Click on the Office Chair product card
5. See **Stock on Hand: 15 units** (was 20, sold 5)

---

## ⚡ Step 7: Manual Stock Adjustment

1. On Office Chair product card, click **Stock** button
2. Click **Manual Adjustment** tab
3. Enter:
   - Adjustment: **+5**
   - Notes: "Physical count correction"
4. Review preview:
   - Current: 15
   - Adjustment: +5
   - New: 20
5. Click **Record Adjustment**

**Result:**
- Stock updated to 20
- Movement recorded
- Journal entry created

---

## 📊 What You'll See in Stock Movements Tab:

```
┌────────────────────────────────────────────────────────────────────┐
│ Date       Product       Type       Quantity  Reference    Notes   │
├────────────────────────────────────────────────────────────────────┤
│ 2025-01-19 Office Chair  adjustment   +5     ADJ-...      Physical │
│ 2025-01-19 Office Chair  sale         -5     INV-00001    Sold...  │
│ 2025-01-19 Office Chair  purchase    +20     INITIAL      Initial  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Features to Try:

### **Summary Dashboard**
- Shows real-time inventory value
- Low stock alerts
- Out of stock count

### **Stock Movements Tab**
- Global view of all movements
- Filter by product
- See complete history

### **Alerts Tab**
- Low stock products
- Out of stock products
- Quick adjust actions

### **Per-Product Management**
- Click "Stock" on any product
- See movement history
- Make manual adjustments

---

## 💼 Accounting Verification:

### **Check Accounts:**
Go to **Accounts** tab:

- **Inventory (1300):** Should show balance = inventory value
- **Accounts Payable (2000):** Should show vendor balances
- **Accounts Receivable (1200):** Should show customer balances
- **COGS (5000):** Should show cost of goods sold

### **Check Journal Entries:**
Go to **Journal** tab - You should see:

1. **Initial Purchase Entry:**
   - Debit Inventory $1,000
   - Credit A/P $1,000

2. **Invoice Revenue Entry:**
   - Debit A/R $500
   - Credit Revenue $500

3. **COGS Entry:**
   - Debit COGS $250
   - Credit Inventory $250

---

## ✅ Success Checklist:

- [ ] Stock movements table created
- [ ] Unit of measure column added
- [ ] Vendor created
- [ ] Product created with initial purchase
- [ ] Vendor balance shows $1,000
- [ ] Inventory value shows $1,000
- [ ] Invoice created and sent
- [ ] Stock automatically reduced
- [ ] Stock movement recorded with "Sold to..." note
- [ ] COGS journal entry created
- [ ] Manual adjustment works
- [ ] Stock Movements tab shows all history
- [ ] Alerts tab shows appropriate alerts

---

## 🎉 You're All Set!

Your product system now has:
✅ Automatic stock tracking from invoices  
✅ Manual adjustment capability  
✅ Vendor balance tracking  
✅ Complete double-entry bookkeeping  
✅ Full audit trail  
✅ Low stock alerts  

---

## 📚 Need Help?

See `COMPLETE_PRODUCT_SYSTEM.md` for:
- Complete accounting flow explanations
- All journal entry details
- Technical implementation docs
- Troubleshooting guide

