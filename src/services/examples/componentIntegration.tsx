/**
 * Component Integration Examples
 * Shows how to integrate services into React components
 * 
 * NOTE: This file is for REFERENCE ONLY and contains example code snippets.
 * Copy the patterns from this file into your actual components.
 * This file is not meant to be compiled directly.
 */

/* eslint-disable */
// @ts-nocheck

import { useState } from 'react';
import { TransactionService, BudgetService, CustomerService } from '@/services';
import type { Transaction, Budget, Customer } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

/**
 * Example 1: Transaction Form Component
 */
export function TransactionFormExample() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (formData: Partial<Transaction>) => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create transaction using service
      const result = await TransactionService.createTransaction({
        ...formData,
        user_id: user.id,
      } as Transaction);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Transaction created successfully'
        });
        
        // Budgets and balances are automatically updated by the service
        // No need to manually trigger updates
      } else {
        // Display validation errors
        toast({
          title: 'Validation Error',
          description: result.errors?.join(', ') || result.error,
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit({
        description: formData.get('description') as string,
        amount: parseFloat(formData.get('amount') as string),
        account_id: formData.get('account_id') as string,
        transaction_date: formData.get('date') as string,
        status: 'pending'
      });
    }}>
      {/* Form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Transaction'}
      </button>
    </form>
  );
}

/**
 * Example 2: Budget Manager with Warnings
 */
export function BudgetManagerExample() {
  const [warnings, setWarnings] = useState<string[]>([]);
  const { toast } = useToast();

  const checkBudgets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await BudgetService.checkBudgetStatus(user.id);
    
    if (result.success && result.data) {
      setWarnings(result.data.warnings);
      
      // Show toast for critical warnings
      result.data.overBudget.forEach((budget: any) => {
        toast({
          title: 'Budget Alert',
          description: `${budget.name} is over budget!`,
          variant: 'destructive'
        });
      });
    }
  };

  const createBudget = async (budgetData: Budget) => {
    const result = await BudgetService.createBudget(budgetData);
    
    if (result.success) {
      toast({ title: 'Budget created successfully' });
      // The service automatically calculates initial spent_amount
    } else {
      toast({
        title: 'Error',
        description: result.error,
        variant: 'destructive'
      });
    }
  };

  return (
    <div>
      {warnings.map((warning, i) => (
        <div key={i} className="alert alert-warning">{warning}</div>
      ))}
      {/* Budget creation form */}
    </div>
  );
}

/**
 * Example 3: Customer Invoice with Credit Limit Validation
 */
export function CustomerInvoiceExample() {
  const { toast } = useToast();

  const createInvoice = async (customerId: string, amount: number) => {
    // Check credit limit before creating invoice
    const creditCheck = await CustomerService.checkCreditLimit(customerId, amount);
    
    if (!creditCheck.success) {
      toast({
        title: 'Error',
        description: creditCheck.error,
        variant: 'destructive'
      });
      return;
    }

    if (!creditCheck.data?.withinLimit) {
      toast({
        title: 'Credit Limit Exceeded',
        description: `Available credit: $${creditCheck.data?.availableCredit.toFixed(2)}`,
        variant: 'destructive'
      });
      return;
    }

    // Create transaction (invoice)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await TransactionService.createTransaction({
      user_id: user.id,
      description: 'Invoice',
      amount: amount, // Positive for receivable
      customer_id: customerId,
      account_id: 'accounts-receivable-id',
      transaction_date: new Date().toISOString().split('T')[0],
      status: 'pending'
    });

    if (result.success) {
      toast({
        title: 'Invoice Created',
        description: 'Customer balance updated automatically'
      });
      // Customer balance is automatically updated by TransactionService
    }
  };

  return <div>{/* Invoice form */}</div>;
}

/**
 * Example 4: Dashboard with Reports
 */
export function DashboardExample() {
  const [summary, setSummary] = useState<any>(null);
  const [spending, setSpending] = useState<any[]>([]);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Import ReportService
    const { ReportService } = await import('@/services');

    // Get financial summary
    const summaryResult = await ReportService.getFinancialSummary(
      user.id,
      '2025-01-01',
      '2025-12-31'
    );

    if (summaryResult.success) {
      setSummary(summaryResult.data);
    }

    // Get spending by category
    const spendingResult = await ReportService.getSpendingByCategory(
      user.id,
      '2025-01-01',
      '2025-01-31'
    );

    if (spendingResult.success) {
      setSpending(spendingResult.data || []);
    }
  };

  return (
    <div>
      {summary && (
        <div>
          <h2>Financial Summary</h2>
          <p>Revenue: ${summary.totalRevenue.toFixed(2)}</p>
          <p>Expenses: ${summary.totalExpenses.toFixed(2)}</p>
          <p>Net Income: ${summary.netIncome.toFixed(2)}</p>
        </div>
      )}

      {spending.length > 0 && (
        <div>
          <h2>Spending by Category</h2>
          {spending.map((item, i) => (
            <div key={i}>
              {item.category}: ${item.amount.toFixed(2)} ({item.count} transactions)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Updating Records with Timestamps
 */
export function UpdateProfileExample() {
  const { toast } = useToast();

  const updateProfile = async (profileId: string, updates: any) => {
    // Import timestamp utility
    const { withTimestamp } = await import('@/services');

    // Update with automatic timestamp
    const { error } = await supabase
      .from('profiles')
      .update(withTimestamp(updates))
      .eq('id', profileId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Profile updated',
        description: 'Changes saved successfully'
      });
    }
  };

  return <div>{/* Profile form */}</div>;
}

/**
 * Example 6: Bulk Transaction Import
 */
export function TransactionImportExample() {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const importTransactions = async (file: File) => {
    try {
      setImporting(true);

      // Parse CSV or other format
      const transactions: Transaction[] = []; // Parse from file

      // Import using bulk service
      const result = await TransactionService.bulkCreateTransactions(transactions);

      if (result.success && result.data) {
        toast({
          title: 'Import Complete',
          description: `Created ${result.data.created} transactions. Failed: ${result.data.failed}`
        });

        if (result.data.errors.length > 0) {
          console.error('Import errors:', result.data.errors);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importTransactions(file);
        }}
        disabled={importing}
      />
    </div>
  );
}

