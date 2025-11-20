# Migration Guide: Updating Components to Use Services

This guide walks you through updating your existing components to use the new backend services instead of direct database operations.

## Quick Start

1. **Run the migration**:
   ```bash
   supabase db push
   ```

2. **Import services in your components**:
   ```typescript
   import { TransactionService, BudgetService } from '@/services';
   ```

3. **Replace direct Supabase calls with service methods**

## Component-by-Component Updates

### 1. BudgetManager Component

**File**: `src/components/budget/BudgetManager.tsx`

#### Current Implementation Issues
- Budget `spent_amount` is calculated by database trigger (which we removed)
- Real-time updates work but calculations won't update

#### Required Changes

**Replace the `createBudget` function:**

```typescript
// OLD CODE (lines 138-187)
const createBudget = async () => {
  try {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('budgets')
      .insert([{
        user_id: userData.user.id,
        name: newBudget.name,
        amount: parseFloat(newBudget.amount),
        budget_type: newBudget.budget_type,
        category_id: newBudget.category_id || null,
        account_id: newBudget.account_id || null,
        start_date: newBudget.start_date,
        end_date: newBudget.end_date
      }]);

    if (error) throw error;
    // ... rest of the code
  }
};

// NEW CODE (use BudgetService)
import { BudgetService } from '@/services';

const createBudget = async () => {
  try {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const result = await BudgetService.createBudget({
      user_id: userData.user.id,
      name: newBudget.name,
      amount: parseFloat(newBudget.amount),
      budget_type: newBudget.budget_type as 'monthly' | 'quarterly' | 'yearly',
      category_id: newBudget.category_id || undefined,
      account_id: newBudget.account_id || undefined,
      start_date: newBudget.start_date,
      end_date: newBudget.end_date
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create budget');
    }

    toast({
      title: "Success",
      description: "Budget created successfully"
    });

    setIsCreateDialogOpen(false);
    setNewBudget({
      name: '',
      amount: '',
      budget_type: 'monthly',
      category_id: '',
      account_id: '',
      start_date: '',
      end_date: ''
    });
    
    fetchBudgets();
  } catch (error) {
    console.error('Error creating budget:', error);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};
```

**Add budget warnings on component mount:**

```typescript
// Add this useEffect after the existing ones
useEffect(() => {
  checkBudgetWarnings();
}, []);

const checkBudgetWarnings = async () => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  const result = await BudgetService.checkBudgetStatus(userData.user.id);
  
  if (result.success && result.data) {
    // Show warnings for over-budget items
    result.data.overBudget.forEach((budget: any) => {
      toast({
        title: "Budget Alert",
        description: `"${budget.name}" is over budget!`,
        variant: "destructive"
      });
    });
  }
};
```

---

### 2. CustomerManager Component

**File**: `src/components/customers/CustomerManager.tsx`

#### Required Changes

**Replace the `createCustomer` function:**

```typescript
// Add import at top
import { CustomerService } from '@/services';

// Replace the createCustomer function (lines 86-141)
const createCustomer = async () => {
  try {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const result = await CustomerService.createCustomer({
      user_id: userData.user.id,
      name: newCustomer.name,
      email: newCustomer.email || undefined,
      phone: newCustomer.phone || undefined,
      company_name: newCustomer.company_name || undefined,
      address: newCustomer.address || undefined,
      tax_number: newCustomer.tax_number || undefined,
      customer_type: newCustomer.customer_type as 'customer' | 'client',
      payment_terms: parseInt(newCustomer.payment_terms),
      credit_limit: newCustomer.credit_limit ? parseFloat(newCustomer.credit_limit) : 0,
      notes: newCustomer.notes || undefined
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create customer');
    }

    toast({
      title: "Success",
      description: "Customer created successfully"
    });

    setIsCreateDialogOpen(false);
    setNewCustomer({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      address: '',
      tax_number: '',
      customer_type: 'customer',
      payment_terms: '30',
      credit_limit: '',
      notes: ''
    });
    
    fetchCustomers();
  } catch (error: any) {
    console.error('Error creating customer:', error);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};
```

---

### 3. VendorManager Component

**File**: `src/components/vendors/VendorManager.tsx`

#### Required Changes

**Replace the `createVendor` function:**

```typescript
// Add import at top
import { VendorService } from '@/services';

// Replace the createVendor function (lines 86-141)
const createVendor = async () => {
  try {
    setIsLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Not authenticated');

    const result = await VendorService.createVendor({
      user_id: userData.user.id,
      name: newVendor.name,
      email: newVendor.email || undefined,
      phone: newVendor.phone || undefined,
      company_name: newVendor.company_name || undefined,
      address: newVendor.address || undefined,
      tax_number: newVendor.tax_number || undefined,
      vendor_type: newVendor.vendor_type as 'vendor' | 'supplier',
      payment_terms: parseInt(newVendor.payment_terms),
      credit_limit: newVendor.credit_limit ? parseFloat(newVendor.credit_limit) : 0,
      notes: newVendor.notes || undefined
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to create vendor');
    }

    toast({
      title: "Success",
      description: "Vendor created successfully"
    });

    setIsCreateDialogOpen(false);
    setNewVendor({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      address: '',
      tax_number: '',
      vendor_type: 'vendor',
      payment_terms: '30',
      credit_limit: '',
      notes: ''
    });
    
    fetchVendors();
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setIsLoading(false);
  }
};
```

---

### 4. AccountingDashboard Component

**File**: `src/components/dashboard/AccountingDashboard.tsx`

#### Required Changes

**Replace the financial summary calculation:**

```typescript
// Add import at top
import { ReportService } from '@/services';

// Replace the fetchDashboardData function (lines 75-148)
const fetchDashboardData = async () => {
  try {
    setLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    
    // Fetch recent transactions with related data (keep as is)
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        *,
        account:accounts(name, account_type),
        category:categories(name, color)
      `)
      .order('transaction_date', { ascending: false })
      .limit(10);

    if (transactionsError) throw transactionsError;
    
    // Fetch accounts (keep as is)
    const { data: accountsData, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('code');

    if (accountsError) throw accountsError;

    // Use ReportService for financial summary
    const summaryResult = await ReportService.getFinancialSummary(userData.user.id);
    
    if (!summaryResult.success) {
      throw new Error(summaryResult.error || 'Failed to load summary');
    }

    setTransactions(transactionsData || []);
    setAccounts(accountsData || []);
    setSummary(summaryResult.data || {
      totalRevenue: 0,
      totalExpenses: 0,
      netIncome: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    toast({
      title: "Error",
      description: "Failed to load dashboard data",
      variant: "destructive"
    });
  } finally {
    setLoading(false);
  }
};
```

---

### 5. AI Accountant Edge Function

**File**: `supabase/functions/ai-accountant/index.ts`

#### Required Changes

**Add service imports and use them for transaction creation:**

```typescript
// You'll need to make services available to Edge Functions
// Option 1: Copy services to Edge Function directory
// Option 2: Use HTTP calls to a service layer
// Option 3: Duplicate the validation logic in Edge Function

// Example using validation before insert:
async function createTransactionFromAI(data: any) {
  // Validate account exists
  const { data: account } = await supabaseClient
    .from('accounts')
    .select('is_active')
    .eq('id', data.account_id)
    .single();
  
  if (!account || !account.is_active) {
    throw new Error('Invalid account');
  }

  // Validate category if provided
  if (data.category_id) {
    const { data: category } = await supabaseClient
      .from('categories')
      .select('id')
      .eq('id', data.category_id)
      .single();
    
    if (!category) {
      throw new Error('Invalid category');
    }
  }

  // Create transaction
  const { data: transaction, error } = await supabaseClient
    .from('transactions')
    .insert([data])
    .select()
    .single();

  if (error) throw error;

  // Trigger budget recalculation by calling service endpoint
  // (You'd need to expose this as an HTTP endpoint)
  // OR duplicate the calculation logic here
  
  return transaction;
}
```

---

## Testing Checklist

After making these changes, test the following:

### Budget Management
- [ ] Create a new budget
- [ ] Verify `spent_amount` is calculated correctly on creation
- [ ] Create a transaction in the budget's category
- [ ] Verify budget `spent_amount` updates
- [ ] Check that over-budget warnings appear

### Customer Management
- [ ] Create a new customer
- [ ] Create a transaction linked to customer
- [ ] Verify customer balance updates
- [ ] Test credit limit validation
- [ ] Verify balance displayed correctly

### Vendor Management
- [ ] Create a new vendor
- [ ] Create a transaction linked to vendor
- [ ] Verify vendor balance updates
- [ ] Check balance displayed correctly

### Transaction Management
- [ ] Create a transaction
- [ ] Verify validation errors for invalid data
- [ ] Verify budgets update automatically
- [ ] Verify customer/vendor balances update
- [ ] Update a transaction and verify recalculations
- [ ] Delete a transaction and verify recalculations

### Dashboard
- [ ] Verify financial summary calculates correctly
- [ ] Check all account types sum properly
- [ ] Test date filtering

## Common Issues and Solutions

### Issue: Balances not updating

**Solution**: Make sure you're using the service methods (`TransactionService.createTransaction`) instead of direct Supabase inserts.

### Issue: Budget spent_amount is 0

**Solution**: After running the migration, recalculate all budgets:

```typescript
import { BudgetService } from '@/services';

// Run this once after migration
const { data: { user } } = await supabase.auth.getUser();
await BudgetService.recalculateUserBudgets(user.id);
```

### Issue: Type errors with service methods

**Solution**: Import the types from services:

```typescript
import type { Transaction, Budget, Customer } from '@/services';
```

### Issue: Validation errors not showing

**Solution**: Check both `result.error` and `result.errors`:

```typescript
if (!result.success) {
  const message = result.errors?.join(', ') || result.error || 'Unknown error';
  toast({ title: 'Error', description: message, variant: 'destructive' });
}
```

## Next Steps

1. **Update all components** using this guide
2. **Test thoroughly** with sample data
3. **Monitor** for any console errors
4. **Add error tracking** (Sentry, etc.) to catch issues in production
5. **Consider adding** background jobs for periodic balance reconciliation

## Need Help?

If you encounter issues during migration, check:
- `src/services/README.md` - Detailed service documentation
- `src/services/examples/componentIntegration.tsx` - More examples
- Console logs for detailed error messages

