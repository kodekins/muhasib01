/**
 * Transaction Service
 * Handles transaction-related business logic with validation and cascading updates
 */

import { supabase } from '@/integrations/supabase/client';
import { Transaction, ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';
import { BudgetService } from './budgetService';
import { CustomerService } from './customerService';
import { VendorService } from './vendorService';

export class TransactionService {
  /**
   * Validate transaction before creating/updating
   */
  static async validateTransaction(transaction: Partial<Transaction>): Promise<ServiceResponse> {
    const errors: string[] = [];

    try {
      // Validate required fields
      if (!transaction.user_id) errors.push('User ID is required');
      if (!transaction.description) errors.push('Description is required');
      if (transaction.amount === undefined || transaction.amount === null) {
        errors.push('Amount is required');
      }
      if (!transaction.account_id) errors.push('Account is required');

      // Check if account exists and is active
      if (transaction.account_id) {
        const { data: account, error } = await supabase
          .from('accounts')
          .select('is_active, user_id')
          .eq('id', transaction.account_id)
          .single();

        if (error || !account) {
          errors.push('Account does not exist');
        } else if (!account.is_active) {
          errors.push('Account is inactive');
        } else if (account.user_id !== transaction.user_id) {
          errors.push('Account does not belong to user');
        }
      }

      // Check if category exists (if provided)
      if (transaction.category_id) {
        const { data: category, error } = await supabase
          .from('categories')
          .select('user_id')
          .eq('id', transaction.category_id)
          .single();

        if (error || !category) {
          errors.push('Category does not exist');
        } else if (category.user_id !== transaction.user_id) {
          errors.push('Category does not belong to user');
        }
      }

      // Check if customer exists and validate credit limit (if provided)
      if (transaction.customer_id) {
        const { data: customer, error } = await supabase
          .from('customers')
          .select('is_active, credit_limit, balance, user_id')
          .eq('id', transaction.customer_id)
          .single();

        if (error || !customer) {
          errors.push('Customer does not exist');
        } else if (!customer.is_active) {
          errors.push('Customer is inactive');
        } else if (customer.user_id !== transaction.user_id) {
          errors.push('Customer does not belong to user');
        } else if (transaction.amount && transaction.amount > 0) {
          // Check credit limit for positive amounts (receivables)
          const newBalance = customer.balance + transaction.amount;
          if (newBalance > customer.credit_limit) {
            errors.push(
              `Transaction would exceed customer credit limit. ` +
              `Available credit: $${(customer.credit_limit - customer.balance).toFixed(2)}`
            );
          }
        }
      }

      // Check if vendor exists (if provided)
      if (transaction.vendor_id) {
        const { data: vendor, error } = await supabase
          .from('vendors')
          .select('is_active, user_id')
          .eq('id', transaction.vendor_id)
          .single();

        if (error || !vendor) {
          errors.push('Vendor does not exist');
        } else if (!vendor.is_active) {
          errors.push('Vendor is inactive');
        } else if (vendor.user_id !== transaction.user_id) {
          errors.push('Vendor does not belong to user');
        }
      }

      // Can't have both customer and vendor
      if (transaction.customer_id && transaction.vendor_id) {
        errors.push('Transaction cannot have both customer and vendor');
      }

      if (errors.length > 0) {
        return { success: false, errors };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error validating transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new transaction with validation and cascading updates
   */
  static async createTransaction(transaction: Transaction): Promise<ServiceResponse<Transaction>> {
    try {
      // Validate transaction
      const validation = await this.validateTransaction(transaction);
      if (!validation.success) {
        return validation;
      }

      // Insert transaction
      const { data, error } = await supabase
        .from('transactions')
        .insert([transaction])
        .select()
        .single();

      if (error) throw error;

      // Trigger cascading updates
      if (data) {
        await this.handleTransactionSideEffects(data);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a transaction with validation and cascading updates
   */
  static async updateTransaction(
    transactionId: string,
    updates: Partial<Transaction>
  ): Promise<ServiceResponse<Transaction>> {
    try {
      // Get existing transaction
      const { data: existing, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) {
        return { success: false, error: 'Transaction not found' };
      }

      // Merge updates with existing data for validation
      const merged = { ...existing, ...updates };
      const validation = await this.validateTransaction(merged);
      if (!validation.success) {
        return validation;
      }

      // Update transaction
      const { data, error } = await supabase
        .from('transactions')
        .update(withTimestamp(updates))
        .eq('id', transactionId)
        .select()
        .single();

      if (error) throw error;

      // Handle side effects for both old and new values
      if (data) {
        // Update old relationships
        await this.handleTransactionSideEffects(existing);
        // Update new relationships
        await this.handleTransactionSideEffects(data);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a transaction and update related entities
   */
  static async deleteTransaction(transactionId: string): Promise<ServiceResponse> {
    try {
      // Get transaction details before deleting
      const { data: transaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (fetchError) throw fetchError;
      if (!transaction) {
        return { success: false, error: 'Transaction not found' };
      }

      // Delete transaction
      const { error: deleteError } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId);

      if (deleteError) throw deleteError;

      // Update related entities
      await this.handleTransactionSideEffects(transaction);

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle side effects after transaction create/update/delete
   */
  private static async handleTransactionSideEffects(transaction: Transaction): Promise<void> {
    // Update budgets if transaction has category or account
    if (transaction.category_id || transaction.account_id) {
      await BudgetService.recalculateBudgetsForTransaction(
        transaction.user_id,
        transaction.category_id,
        transaction.account_id,
        transaction.transaction_date
      );
    }

    // Update customer balance
    if (transaction.customer_id) {
      await CustomerService.calculateCustomerBalance(transaction.customer_id);
    }

    // Update vendor balance
    if (transaction.vendor_id) {
      await VendorService.calculateVendorBalance(transaction.vendor_id);
    }
  }

  /**
   * Bulk create transactions (useful for imports)
   */
  static async bulkCreateTransactions(
    transactions: Transaction[]
  ): Promise<ServiceResponse<{ created: number; failed: number; errors: string[] }>> {
    const errors: string[] = [];
    let created = 0;
    let failed = 0;

    for (const transaction of transactions) {
      const result = await this.createTransaction(transaction);
      if (result.success) {
        created++;
      } else {
        failed++;
        errors.push(`Failed to create transaction: ${result.error || result.errors?.join(', ')}`);
      }
    }

    return {
      success: true,
      data: { created, failed, errors }
    };
  }

  /**
   * Get transactions with filters
   */
  static async getTransactions(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      accountId?: string;
      categoryId?: string;
      customerId?: string;
      vendorId?: string;
      status?: string;
      minAmount?: number;
      maxAmount?: number;
    }
  ): Promise<ServiceResponse<Transaction[]>> {
    try {
      let query = supabase
        .from('transactions')
        .select('*, account:accounts(name), category:categories(name, color)')
        .eq('user_id', userId);

      if (filters?.startDate) {
        query = query.gte('transaction_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('transaction_date', filters.endDate);
      }
      if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
      }
      if (filters?.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.minAmount !== undefined) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters?.maxAmount !== undefined) {
        query = query.lte('amount', filters.maxAmount);
      }

      query = query.order('transaction_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error getting transactions:', error);
      return { success: false, error: error.message };
    }
  }
}

