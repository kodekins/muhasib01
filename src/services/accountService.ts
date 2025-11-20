/**
 * Account Service
 * Handles Chart of Accounts management
 * All business logic in application code
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse, Account } from './types';

export class AccountService {
  /**
   * Get all accounts for a user
   */
  static async getAccounts(
    userId: string,
    filters?: {
      type?: string;
      active?: boolean;
    }
  ): Promise<ServiceResponse<Account[]>> {
    try {
      let query = supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .order('code');

      if (filters?.type) {
        query = query.eq('account_type', filters.type);
      }

      if (filters?.active !== undefined) {
        query = query.eq('is_active', filters.active);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch accounts'
      };
    }
  }

  /**
   * Get single account by ID
   */
  static async getAccountById(accountId: string): Promise<ServiceResponse<Account>> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Account not found'
      };
    }
  }

  /**
   * Create new account
   * Business logic: Validate code uniqueness, type, and structure
   */
  static async createAccount(account: {
    user_id: string;
    name: string;
    code: string;
    account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    description?: string;
    parent_account_id?: string;
  }): Promise<ServiceResponse<Account>> {
    try {
      // Validation: Check if code already exists for this user
      const { data: existing } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', account.user_id)
        .eq('code', account.code)
        .single();

      if (existing) {
        return {
          success: false,
          error: `Account code ${account.code} already exists`
        };
      }

      // Validation: Verify account code format (e.g., 1000-9999)
      const codeNum = parseInt(account.code);
      if (isNaN(codeNum) || codeNum < 1000 || codeNum > 9999) {
        return {
          success: false,
          error: 'Account code must be between 1000 and 9999'
        };
      }

      // Business logic: Validate parent account type compatibility
      if (account.parent_account_id) {
        const { data: parentAccount } = await supabase
          .from('accounts')
          .select('account_type')
          .eq('id', account.parent_account_id)
          .single();

        if (parentAccount && parentAccount.account_type !== account.account_type) {
          return {
            success: false,
            error: 'Parent account must be the same type'
          };
        }
      }

      // Create account
      const { data, error } = await supabase
        .from('accounts')
        .insert([{
          user_id: account.user_id,
          name: account.name,
          code: account.code,
          account_type: account.account_type,
          description: account.description,
          parent_account_id: account.parent_account_id,
          balance: 0,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Account created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create account'
      };
    }
  }

  /**
   * Update account
   */
  static async updateAccount(
    accountId: string,
    updates: Partial<Account>
  ): Promise<ServiceResponse<Account>> {
    try {
      // If updating code, check uniqueness
      if (updates.code) {
        const { data: currentAccount } = await supabase
          .from('accounts')
          .select('user_id')
          .eq('id', accountId)
          .single();

        if (currentAccount) {
          const { data: existing } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', currentAccount.user_id)
            .eq('code', updates.code)
            .neq('id', accountId)
            .single();

          if (existing) {
            return {
              success: false,
              error: `Account code ${updates.code} already exists`
            };
          }
        }
      }

      const { data, error } = await supabase
        .from('accounts')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', accountId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Account updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update account'
      };
    }
  }

  /**
   * Calculate account balance from journal entries
   * Business logic: Aggregates debits and credits
   */
  static async calculateAccountBalance(
    accountId: string,
    asOfDate?: string
  ): Promise<ServiceResponse<{ balance: number; debit_total: number; credit_total: number }>> {
    try {
      // Get account type to determine normal balance
      const { data: account } = await supabase
        .from('accounts')
        .select('account_type')
        .eq('id', accountId)
        .single();

      if (!account) {
        return {
          success: false,
          error: 'Account not found'
        };
      }

      // Query journal entry lines for this account
      let query = supabase
        .from('journal_entry_lines')
        .select('debit, credit')
        .eq('account_id', accountId);

      if (asOfDate) {
        // Join with journal_entries to filter by date
        const { data: lines } = await supabase
          .from('journal_entry_lines')
          .select('debit, credit, journal_entries!inner(entry_date)')
          .eq('account_id', accountId)
          .lte('journal_entries.entry_date', asOfDate);

        if (lines) {
          const debit_total = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
          const credit_total = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

          // Business logic: Calculate balance based on account type
          // Assets, Expenses: Debit increases, Credit decreases (Normal Debit)
          // Liabilities, Equity, Revenue: Credit increases, Debit decreases (Normal Credit)
          const normalDebitTypes = ['asset', 'expense'];
          let balance = normalDebitTypes.includes(account.account_type)
            ? debit_total - credit_total
            : credit_total - debit_total;

          return {
            success: true,
            data: {
              balance,
              debit_total,
              credit_total
            }
          };
        }
      }

      const { data: lines } = await query;

      if (!lines) {
        return {
          success: true,
          data: {
            balance: 0,
            debit_total: 0,
            credit_total: 0
          }
        };
      }

      // Calculate totals
      const debit_total = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const credit_total = lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      // Calculate balance based on account type
      const normalDebitTypes = ['asset', 'expense'];
      let balance = normalDebitTypes.includes(account.account_type)
        ? debit_total - credit_total
        : credit_total - debit_total;

      // Update account balance in database
      await supabase
        .from('accounts')
        .update({ balance })
        .eq('id', accountId);

      return {
        success: true,
        data: {
          balance,
          debit_total,
          credit_total
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to calculate balance'
      };
    }
  }

  /**
   * Get accounts by type for reporting
   */
  static async getAccountsByType(
    userId: string,
    accountType: string
  ): Promise<ServiceResponse<Account[]>> {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('account_type', accountType)
        .eq('is_active', true)
        .order('code');

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch accounts'
      };
    }
  }

  /**
   * Deactivate account (soft delete)
   * Business logic: Check if account has transactions
   */
  static async deactivateAccount(accountId: string): Promise<ServiceResponse<void>> {
    try {
      // Check if account has journal entries
      const { data: entries, error: checkError } = await supabase
        .from('journal_entry_lines')
        .select('id')
        .eq('account_id', accountId)
        .limit(1);

      if (checkError) throw checkError;

      if (entries && entries.length > 0) {
        return {
          success: false,
          error: 'Cannot deactivate account with existing transactions. Consider archiving instead.'
        };
      }

      // Deactivate account
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) throw error;

      return {
        success: true,
        message: 'Account deactivated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to deactivate account'
      };
    }
  }
}

