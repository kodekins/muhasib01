# Backend Services

This directory contains all business logic services that handle operations previously managed by database triggers.

## Architecture

```
src/services/
├── types.ts                 # Shared TypeScript interfaces
├── utils/
│   └── timestamp.ts         # Timestamp management utilities
├── budgetService.ts         # Budget calculations and management
├── customerService.ts       # Customer balance and validation
├── vendorService.ts         # Vendor balance and validation
├── transactionService.ts    # Transaction CRUD with validation
├── reportService.ts         # Financial reports and summaries
└── index.ts                 # Central export point
```

## Services Overview

### 1. BudgetService

Handles budget-related operations and spent amount calculations.

**Key Methods:**
- `calculateBudgetSpent(budgetId)` - Calculate spent amount for a budget
- `recalculateUserBudgets(userId)` - Recalculate all budgets for a user
- `recalculateBudgetsForTransaction(...)` - Update budgets affected by a transaction
- `checkBudgetStatus(userId)` - Get budget warnings and status
- `createBudget(budget)` - Create with validation
- `updateBudget(budgetId, updates)` - Update and recalculate

### 2. CustomerService

Manages customer relationships and balance calculations.

**Key Methods:**
- `calculateCustomerBalance(customerId)` - Calculate customer balance from transactions
- `recalculateAllCustomerBalances(userId)` - Recalculate all customer balances
- `createCustomer(customer)` - Create with validation
- `updateCustomer(customerId, updates)` - Update with validation
- `checkCreditLimit(customerId, amount)` - Validate against credit limit
- `getCustomersWithBalance(userId)` - Get customers with outstanding balances

### 3. VendorService

Manages vendor relationships and balance calculations.

**Key Methods:**
- `calculateVendorBalance(vendorId)` - Calculate vendor balance from transactions
- `recalculateAllVendorBalances(userId)` - Recalculate all vendor balances
- `createVendor(vendor)` - Create with validation
- `updateVendor(vendorId, updates)` - Update with validation
- `getVendorsWithBalance(userId)` - Get vendors we owe money to
- `getTotalOwed(userId)` - Calculate total owed to all vendors

### 4. TransactionService

Core transaction operations with comprehensive validation and cascading updates.

**Key Methods:**
- `validateTransaction(transaction)` - Validate before save
- `createTransaction(transaction)` - Create with validation and side effects
- `updateTransaction(transactionId, updates)` - Update with validation
- `deleteTransaction(transactionId)` - Delete and update related entities
- `bulkCreateTransactions(transactions)` - Import multiple transactions
- `getTransactions(userId, filters)` - Query with filters

**Automatic Side Effects:**
- Updates affected budgets
- Recalculates customer/vendor balances
- Validates credit limits
- Ensures data integrity

### 5. ReportService

Financial reporting and analysis.

**Key Methods:**
- `getFinancialSummary(userId, startDate, endDate)` - Get overall summary
- `generateProfitLoss(userId, startDate, endDate)` - P&L report
- `generateBalanceSheet(userId, asOfDate)` - Balance sheet
- `getSpendingByCategory(userId, startDate, endDate)` - Category analysis
- `getMonthlyTrends(userId, year)` - Monthly trend analysis

## Usage Examples

### Creating a Transaction

```typescript
import { TransactionService } from '@/services';

async function handleCreateTransaction(data: Transaction) {
  const result = await TransactionService.createTransaction({
    user_id: userId,
    description: 'Office supplies',
    amount: -50.00, // Negative for expenses
    transaction_date: '2025-01-18',
    account_id: accountId,
    category_id: categoryId,
    status: 'pending'
  });

  if (result.success) {
    toast.success('Transaction created');
    // Budgets and balances are automatically updated
  } else {
    toast.error(result.error || result.errors?.join(', '));
  }
}
```

### Managing Budgets

```typescript
import { BudgetService } from '@/services';

// Create a budget
const result = await BudgetService.createBudget({
  user_id: userId,
  name: 'Marketing Budget',
  category_id: marketingCategoryId,
  budget_type: 'monthly',
  amount: 5000,
  start_date: '2025-01-01',
  end_date: '2025-01-31'
});

// Check for warnings
const status = await BudgetService.checkBudgetStatus(userId);
if (status.data?.warnings.length > 0) {
  status.data.warnings.forEach(warning => {
    toast.warning(warning);
  });
}
```

### Customer Credit Limit Check

```typescript
import { CustomerService } from '@/services';

async function validateInvoice(customerId: string, amount: number) {
  const check = await CustomerService.checkCreditLimit(customerId, amount);
  
  if (!check.data?.withinLimit) {
    return {
      error: `Customer has insufficient credit. Available: $${check.data?.availableCredit}`
    };
  }
  
  // Proceed with invoice creation
}
```

### Generating Reports

```typescript
import { ReportService } from '@/services';

async function loadDashboard() {
  // Get financial summary
  const summary = await ReportService.getFinancialSummary(
    userId,
    '2025-01-01',
    '2025-12-31'
  );

  // Get category breakdown
  const spending = await ReportService.getSpendingByCategory(
    userId,
    '2025-01-01',
    '2025-01-31'
  );

  // Get monthly trends
  const trends = await ReportService.getMonthlyTrends(userId, 2025);
}
```

### Using Timestamp Utilities

```typescript
import { withTimestamp } from '@/services';

// When updating any record
const { error } = await supabase
  .from('profiles')
  .update(withTimestamp({
    company_name: 'New Company Name'
  }))
  .eq('id', profileId);
```

## Integration Points

### 1. Component Integration

Update your components to use services instead of direct Supabase calls:

**Before:**
```typescript
const { error } = await supabase
  .from('transactions')
  .insert([transactionData]);
```

**After:**
```typescript
const result = await TransactionService.createTransaction(transactionData);
if (!result.success) {
  // Handle validation errors
}
```

### 2. AI Accountant Integration

In your Edge Function (`supabase/functions/ai-accountant/index.ts`):

```typescript
import { TransactionService, ReportService } from '../../src/services';

// When AI creates a transaction
const result = await TransactionService.createTransaction({
  user_id: userId,
  conversation_id: conversationId,
  description: aiExtractedDescription,
  amount: aiExtractedAmount,
  account_id: aiSelectedAccountId,
  category_id: aiSelectedCategoryId,
  transaction_date: aiExtractedDate,
  status: 'pending'
});

// When AI generates a report
const report = await ReportService.generateProfitLoss(
  userId,
  startDate,
  endDate
);
```

### 3. Background Jobs (Optional)

For periodic consistency checks:

```typescript
// Daily job to recalculate all balances
async function dailyReconciliation(userId: string) {
  await BudgetService.recalculateUserBudgets(userId);
  await CustomerService.recalculateAllCustomerBalances(userId);
  await VendorService.recalculateAllVendorBalances(userId);
}
```

## Error Handling

All services return a `ServiceResponse` type:

```typescript
interface ServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;      // Single error message
  errors?: string[];   // Multiple validation errors
}
```

**Example:**
```typescript
const result = await TransactionService.createTransaction(data);

if (result.success) {
  // Use result.data
  console.log('Created transaction:', result.data);
} else {
  // Handle errors
  if (result.errors) {
    // Multiple validation errors
    result.errors.forEach(err => console.error(err));
  } else if (result.error) {
    // Single error
    console.error(result.error);
  }
}
```

## Testing

Each service can be tested independently:

```typescript
import { TransactionService } from '@/services';

describe('TransactionService', () => {
  it('should validate transaction', async () => {
    const result = await TransactionService.validateTransaction({
      // Invalid transaction
      amount: -100,
      // Missing required fields
    });
    
    expect(result.success).toBe(false);
    expect(result.errors).toContain('Description is required');
  });
});
```

## Performance Considerations

1. **Batch Operations**: Use `bulkCreateTransactions` for imports
2. **Caching**: Consider caching financial summaries
3. **Indexes**: Database indexes are already set up in the migration
4. **Async Operations**: All operations are async and can be run in parallel when independent

## Migration from Triggers

The services replace these database triggers:

| Old Trigger | New Service Method |
|-------------|-------------------|
| `update_budget_spent_amounts` | `BudgetService.calculateBudgetSpent()` |
| `update_updated_at_column` | `withTimestamp()` utility |
| Customer balance trigger | `CustomerService.calculateCustomerBalance()` |
| Vendor balance trigger | `VendorService.calculateVendorBalance()` |

All methods are called automatically by `TransactionService` when transactions are created/updated/deleted.

