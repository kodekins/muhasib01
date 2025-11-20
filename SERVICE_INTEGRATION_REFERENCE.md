# Service Integration Reference

## Quick Reference: How Components Use Services

This document shows exactly how each UI component integrates with backend services.

## 📦 Import Pattern

All components follow this pattern:

```typescript
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InvoiceService, BillService, ProductService } from '@/services';
```

## 🔄 Common Integration Patterns

### 1. Fetching Data

```typescript
const fetchData = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const result = await SomeService.getData(userData.user.id, filters);
    
    if (result.success) {
      setData(result.data || []);
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### 2. Creating Records

```typescript
const createRecord = async () => {
  try {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const result = await SomeService.create({
      user_id: userData.user.id,
      ...formData
    });

    if (result.success) {
      toast({ title: 'Success', description: 'Created successfully!' });
      setIsDialogOpen(false);
      resetForm();
      fetchData(); // Refresh list
    } else {
      toast({ 
        title: 'Error', 
        description: result.errors?.join(', ') || result.error,
        variant: 'destructive' 
      });
    }
  } finally {
    setIsLoading(false);
  }
};
```

### 3. Real-Time Subscriptions

```typescript
useEffect(() => {
  fetchData();

  const channel = supabase
    .channel('table-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'table_name' },
      () => {
        console.log('Change detected, refreshing...');
        fetchData();
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

## 📋 Component-by-Component Integration

### InvoiceManager.tsx

```typescript
// Imports
import { InvoiceService } from '@/services';

// Fetching
const result = await InvoiceService.getInvoices(userId, { status, overdue });

// Creating
const result = await InvoiceService.createInvoice({
  user_id: userId,
  customer_id,
  invoice_date,
  due_date,
  lines: validLines,
  subtotal,
  total_amount
}, { postJournalEntry: false });

// Sending (creates journal entry)
const result = await InvoiceService.sendInvoice(invoiceId);

// Recording Payment
const result = await InvoiceService.recordPayment(
  invoiceId,
  amount,
  paymentDate,
  paymentMethod,
  bankAccountId,
  reference
);

// Getting Aging Report
const result = await InvoiceService.getAgingReport(userId);
```

### BillManager.tsx

```typescript
// Imports
import { BillService } from '@/services';

// Fetching
const result = await BillService.getBills(userId, { status, overdue });

// Creating
const result = await BillService.createBill({
  user_id: userId,
  vendor_id,
  bill_date,
  due_date,
  lines: validLines,
  subtotal,
  total_amount
}, { postJournalEntry: false });

// Approving (creates journal entry)
const result = await BillService.approveBill(billId);

// Recording Payment
const result = await BillService.recordPayment(
  billId,
  amount,
  paymentDate,
  paymentMethod,
  bankAccountId,
  reference
);

// Getting Bills Due
const result = await BillService.getBillsDue(userId, daysAhead);
```

### ProductManager.tsx

```typescript
// Imports
import { ProductService } from '@/services';

// Fetching
const result = await ProductService.getProducts(userId, { 
  type, 
  lowStock 
});

// Creating
const result = await ProductService.createProduct({
  user_id: userId,
  name,
  sku,
  product_type,
  unit_price,
  cost_price,
  quantity_in_stock,
  reorder_point
});

// Updating
const result = await ProductService.updateProduct(productId, updates);

// Adjusting Inventory
const result = await ProductService.adjustInventory(
  productId,
  quantityChange,
  reason
);

// Getting Low Stock
const result = await ProductService.getLowStockProducts(userId);
```

### JournalEntriesView.tsx

```typescript
// Imports
import { JournalEntryService } from '@/services';

// Fetching Entries
const result = await JournalEntryService.getJournalEntries(userId, {
  startDate,
  endDate
});

// Creating Entry
const result = await JournalEntryService.createJournalEntry({
  user_id: userId,
  entry_date,
  description,
  lines: [
    { account_id, debit, credit, memo },
    { account_id, debit, credit, memo }
  ]
});

// Getting General Ledger
const result = await JournalEntryService.getGeneralLedger(userId, {
  startDate,
  endDate,
  accountId
});

// Getting Trial Balance
const result = await JournalEntryService.getTrialBalance(userId, asOfDate);
```

### ReportsView.tsx

```typescript
// Imports
import { ReportService, JournalEntryService } from '@/services';

// Profit & Loss
const result = await ReportService.generateProfitLoss(
  userId,
  startDate,
  endDate
);

// Balance Sheet
const result = await ReportService.generateBalanceSheet(
  userId,
  asOfDate
);

// Cash Flow
const result = await ReportService.generateCashFlow(
  userId,
  startDate,
  endDate
);

// General Ledger
const result = await JournalEntryService.getGeneralLedger(userId, {
  startDate,
  endDate
});

// Trial Balance
const result = await JournalEntryService.getTrialBalance(userId, asOfDate);
```

### CustomerManager.tsx

```typescript
// Direct Supabase (no service layer yet)
const { data } = await supabase
  .from('customers')
  .select('*')
  .order('created_at', { ascending: false });

// Can be enhanced with:
import { CustomerService } from '@/services';
const result = await CustomerService.getCustomers(userId);
```

### VendorManager.tsx

```typescript
// Direct Supabase (no service layer yet)
const { data } = await supabase
  .from('vendors')
  .select('*')
  .order('created_at', { ascending: false });

// Can be enhanced with:
import { VendorService } from '@/services';
const result = await VendorService.getVendors(userId);
```

### BudgetManager.tsx

```typescript
// Can use BudgetService
import { BudgetService } from '@/services';

const result = await BudgetService.getBudgets(userId);
const result = await BudgetService.createBudget(budgetData);
const result = await BudgetService.updateBudgetSpent(budgetId);
```

## 🎯 Service Response Format

All services return consistent response format:

```typescript
// Success
{
  success: true,
  data: any,
  message?: string
}

// Error
{
  success: false,
  error: string,
  errors?: string[]
}
```

## ✅ Best Practices

### 1. Always Check Auth
```typescript
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) return; // or redirect to login
```

### 2. Handle Loading States
```typescript
const [isLoading, setIsLoading] = useState(false);

try {
  setIsLoading(true);
  // ... service call
} finally {
  setIsLoading(false);
}
```

### 3. Show User Feedback
```typescript
if (result.success) {
  toast({ title: 'Success', description: 'Operation completed!' });
} else {
  toast({ 
    title: 'Error', 
    description: result.error, 
    variant: 'destructive' 
  });
}
```

### 4. Refresh Data After Changes
```typescript
if (result.success) {
  setIsDialogOpen(false);
  resetForm();
  fetchData(); // Refresh list
}
```

### 5. Use Real-Time Subscriptions
```typescript
const channel = supabase
  .channel('unique-channel-name')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'your_table' },
    fetchData // Re-fetch on any change
  )
  .subscribe();

return () => { supabase.removeChannel(channel); };
```

## 🔧 Service Method Examples

### Invoice Service

```typescript
// Get all invoices
InvoiceService.getInvoices(userId, { status: 'sent' })

// Get single invoice with details
InvoiceService.getInvoiceById(invoiceId)

// Create invoice (draft)
InvoiceService.createInvoice(invoiceData, { postJournalEntry: false })

// Send invoice (posts to books)
InvoiceService.sendInvoice(invoiceId)

// Record payment
InvoiceService.recordPayment(invoiceId, amount, date, method, accountId, ref)

// Get aging report
InvoiceService.getAgingReport(userId)
```

### Bill Service

```typescript
// Get all bills
BillService.getBills(userId, { status: 'approved' })

// Create bill (draft)
BillService.createBill(billData, { postJournalEntry: false })

// Approve bill (posts to books)
BillService.approveBill(billId)

// Record payment
BillService.recordPayment(billId, amount, date, method, accountId, ref)

// Get bills due
BillService.getBillsDue(userId, 30) // next 30 days
```

### Product Service

```typescript
// Get products
ProductService.getProducts(userId, { type: 'product' })

// Create product
ProductService.createProduct(productData)

// Update product
ProductService.updateProduct(productId, { unit_price: 150 })

// Adjust inventory
ProductService.adjustInventory(productId, -5, 'Sold to customer')

// Check low stock
ProductService.getLowStockProducts(userId)
```

### Journal Entry Service

```typescript
// Create entry
JournalEntryService.createJournalEntry({
  user_id: userId,
  entry_date: '2025-01-15',
  description: 'Monthly rent',
  lines: [
    { account_id: '...', debit: 1000, credit: 0, memo: 'Rent expense' },
    { account_id: '...', debit: 0, credit: 1000, memo: 'Cash payment' }
  ]
})

// Get general ledger
JournalEntryService.getGeneralLedger(userId, { 
  startDate: '2025-01-01', 
  endDate: '2025-01-31' 
})

// Get trial balance
JournalEntryService.getTrialBalance(userId, '2025-01-31')
```

### Report Service

```typescript
// Profit & Loss
ReportService.generateProfitLoss(userId, '2025-01-01', '2025-01-31')

// Balance Sheet
ReportService.generateBalanceSheet(userId, '2025-01-31')

// Cash Flow
ReportService.generateCashFlow(userId, '2025-01-01', '2025-01-31')
```

## 🚨 Common Errors & Solutions

### "User not authenticated"
```typescript
// Always check auth first
const { data: userData } = await supabase.auth.getUser();
if (!userData.user) {
  toast({ title: 'Error', description: 'Please sign in', variant: 'destructive' });
  return;
}
```

### "Validation errors"
```typescript
// Check result.errors for detailed messages
if (!result.success) {
  const errorMessage = result.errors?.join(', ') || result.error;
  toast({ title: 'Validation Error', description: errorMessage, variant: 'destructive' });
}
```

### "Journal entry not balanced"
```typescript
// Ensure debits = credits
const debits = lines.reduce((sum, l) => sum + l.debit, 0);
const credits = lines.reduce((sum, l) => sum + l.credit, 0);
if (Math.abs(debits - credits) > 0.01) {
  toast({ title: 'Error', description: 'Debits must equal credits', variant: 'destructive' });
  return;
}
```

### "Invoice not found"
```typescript
// Check if resource exists before operations
const invoiceResult = await InvoiceService.getInvoiceById(invoiceId);
if (!invoiceResult.success) {
  toast({ title: 'Error', description: 'Invoice not found', variant: 'destructive' });
  return;
}
```

## 📚 Additional Resources

- **Type Definitions**: `src/services/types.ts`
- **Service Implementations**: `src/services/*.ts`
- **Component Examples**: `src/components/*/`
- **API Documentation**: `src/services/README.md`

---

## 🎯 Quick Checklist

When integrating a new component:
- [ ] Import required services
- [ ] Get user authentication
- [ ] Handle loading states
- [ ] Show toast notifications
- [ ] Implement real-time subscriptions
- [ ] Handle errors gracefully
- [ ] Validate user input
- [ ] Refresh data after changes
- [ ] Clean up subscriptions on unmount

**You're all set to build and extend!** 🚀

