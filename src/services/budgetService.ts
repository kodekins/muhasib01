/**
 * Budget Service
 * Handles budget-related business logic including spent amount calculations
 */

import { supabase } from '@/integrations/supabase/client';
import { Budget, ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';

export class BudgetService {
  /**
   * Calculate spent amount for a specific budget
   */
  static async calculateBudgetSpent(budgetId: string): Promise<ServiceResponse<number>> {
    try {
      // Get budget details
      const { data: budget, error: budgetError } = await supabase
        .from('budgets')
        .select('category_id, account_id, start_date, end_date, user_id')
        .eq('id', budgetId)
        .single();

      if (budgetError) throw budgetError;
      if (!budget) {
        return { success: false, error: 'Budget not found' };
      }

      // Build query for transactions
      let query = supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', budget.user_id)
        .gte('transaction_date', budget.start_date)
        .lte('transaction_date', budget.end_date)
        .lt('amount', 0); // Only expenses (negative amounts)

      // Filter by category or account
      if (budget.category_id) {
        query = query.eq('category_id', budget.category_id);
      } else if (budget.account_id) {
        query = query.eq('account_id', budget.account_id);
      }

      const { data: transactions, error: transError } = await query;

      if (transError) throw transError;

      // Calculate total spent (convert negative to positive)
      const spentAmount = transactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Update the budget with calculated spent amount
      const { error: updateError } = await supabase
        .from('budgets')
        .update(withTimestamp({ spent_amount: spentAmount }))
        .eq('id', budgetId);

      if (updateError) throw updateError;

      return { success: true, data: spentAmount };
    } catch (error: any) {
      console.error('Error calculating budget spent:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate all active budgets for a user
   */
  static async recalculateUserBudgets(userId: string): Promise<ServiceResponse<number>> {
    try {
      // Get all active budgets for user
      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      if (!budgets || budgets.length === 0) {
        return { success: true, data: 0 };
      }

      // Recalculate each budget
      let updatedCount = 0;
      for (const budget of budgets) {
        const result = await this.calculateBudgetSpent(budget.id);
        if (result.success) {
          updatedCount++;
        }
      }

      return { success: true, data: updatedCount };
    } catch (error: any) {
      console.error('Error recalculating user budgets:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate budgets affected by a transaction
   */
  static async recalculateBudgetsForTransaction(
    userId: string,
    categoryId?: string,
    accountId?: string,
    transactionDate?: string
  ): Promise<ServiceResponse> {
    try {
      if (!categoryId && !accountId) {
        return { success: true }; // No budgets to update
      }

      // Find affected budgets
      let query = supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (transactionDate) {
        query = query
          .lte('start_date', transactionDate)
          .gte('end_date', transactionDate);
      }

      // Filter by category or account
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      } else if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data: budgets, error } = await query;

      if (error) throw error;

      if (!budgets || budgets.length === 0) {
        return { success: true }; // No budgets to update
      }

      // Recalculate each affected budget
      for (const budget of budgets) {
        await this.calculateBudgetSpent(budget.id);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recalculating budgets for transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check budget status and return warnings
   */
  static async checkBudgetStatus(userId: string): Promise<ServiceResponse<{
    overBudget: Budget[];
    nearLimit: Budget[]; // 80%+
    warnings: string[];
  }>> {
    try {
      // Get all active budgets with current spent amounts
      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*, categories(name), accounts(name)')
        .eq('user_id', userId)
        .eq('is_active', true)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      const overBudget: any[] = [];
      const nearLimit: any[] = [];
      const warnings: string[] = [];

      budgets?.forEach((budget: any) => {
        const percentUsed = (budget.spent_amount / budget.amount) * 100;
        const budgetName = budget.name || budget.categories?.name || budget.accounts?.name;

        if (percentUsed >= 100) {
          overBudget.push(budget);
          warnings.push(`Budget "${budgetName}" is over limit (${percentUsed.toFixed(1)}% used)`);
        } else if (percentUsed >= 80) {
          nearLimit.push(budget);
          warnings.push(`Budget "${budgetName}" is near limit (${percentUsed.toFixed(1)}% used)`);
        }
      });

      return {
        success: true,
        data: { overBudget, nearLimit, warnings }
      };
    } catch (error: any) {
      console.error('Error checking budget status:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new budget with validation
   */
  static async createBudget(budget: Budget): Promise<ServiceResponse<Budget>> {
    try {
      // Validate dates
      if (new Date(budget.start_date) >= new Date(budget.end_date)) {
        return { success: false, error: 'Start date must be before end date' };
      }

      // Must have either category_id or account_id
      if (!budget.category_id && !budget.account_id) {
        return { success: false, error: 'Budget must be linked to a category or account' };
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert([{
          ...budget,
          spent_amount: 0
        }])
        .select()
        .single();

      if (error) throw error;

      // Calculate initial spent amount
      if (data) {
        await this.calculateBudgetSpent(data.id);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating budget:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a budget
   */
  static async updateBudget(budgetId: string, updates: Partial<Budget>): Promise<ServiceResponse<Budget>> {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .update(withTimestamp(updates))
        .eq('id', budgetId)
        .select()
        .single();

      if (error) throw error;

      // Recalculate if date range or category/account changed
      if (updates.start_date || updates.end_date || updates.category_id || updates.account_id) {
        await this.calculateBudgetSpent(budgetId);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating budget:', error);
      return { success: false, error: error.message };
    }
  }
}

