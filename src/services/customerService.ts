/**
 * Customer Service
 * Handles customer-related business logic including balance calculations
 */

import { supabase } from '@/integrations/supabase/client';
import { Customer, ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';

export class CustomerService {
  /**
   * Calculate balance for a specific customer
   * Positive balance = customer owes money (balance_due on invoices)
   * Negative balance = customer has credit
   */
  static async calculateCustomerBalance(customerId: string): Promise<ServiceResponse<number>> {
    try {
      // Get customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('user_id')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      // Sum all outstanding invoice balances for this customer
      const { data: invoices, error: invError } = await supabase
        .from('invoices')
        .select('balance_due')
        .eq('customer_id', customerId)
        .eq('user_id', customer.user_id)
        .in('status', ['sent', 'partial', 'overdue', 'viewed']); // Exclude draft and paid

      if (invError) throw invError;

      // Calculate balance from invoices
      const balance = invoices?.reduce((sum, inv) => sum + parseFloat(inv.balance_due.toString()), 0) || 0;

      // Update customer balance
      const { error: updateError } = await supabase
        .from('customers')
        .update(withTimestamp({ balance }))
        .eq('id', customerId);

      if (updateError) throw updateError;

      return { success: true, data: balance };
    } catch (error: any) {
      console.error('Error calculating customer balance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate balances for all customers of a user
   */
  static async recalculateAllCustomerBalances(userId: string): Promise<ServiceResponse<number>> {
    try {
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId);

      if (error) throw error;

      if (!customers || customers.length === 0) {
        return { success: true, data: 0 };
      }

      let updatedCount = 0;
      for (const customer of customers) {
        const result = await this.calculateCustomerBalance(customer.id);
        if (result.success) {
          updatedCount++;
        }
      }

      return { success: true, data: updatedCount };
    } catch (error: any) {
      console.error('Error recalculating customer balances:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new customer with validation
   */
  static async createCustomer(customer: Customer): Promise<ServiceResponse<Customer>> {
    try {
      // Validate required fields
      if (!customer.name || !customer.user_id) {
        return { success: false, error: 'Name and user_id are required' };
      }

      // Validate email format if provided
      if (customer.email && !this.isValidEmail(customer.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const { data, error } = await supabase
        .from('customers')
        .insert([{
          ...customer,
          balance: 0 // Initialize balance
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating customer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a customer
   */
  static async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<ServiceResponse<Customer>> {
    try {
      // Validate email if being updated
      if (updates.email && !this.isValidEmail(updates.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const { data, error } = await supabase
        .from('customers')
        .update(withTimestamp(updates))
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating customer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if customer has exceeded credit limit
   */
  static async checkCreditLimit(customerId: string, additionalAmount: number): Promise<ServiceResponse<{
    withinLimit: boolean;
    currentBalance: number;
    creditLimit: number;
    availableCredit: number;
  }>> {
    try {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('balance, credit_limit')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      if (!customer) {
        return { success: false, error: 'Customer not found' };
      }

      const newBalance = customer.balance + additionalAmount;
      const withinLimit = newBalance <= customer.credit_limit;
      const availableCredit = customer.credit_limit - customer.balance;

      return {
        success: true,
        data: {
          withinLimit,
          currentBalance: customer.balance,
          creditLimit: customer.credit_limit,
          availableCredit
        }
      };
    } catch (error: any) {
      console.error('Error checking credit limit:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get customers with outstanding balances
   */
  static async getCustomersWithBalance(userId: string): Promise<ServiceResponse<Customer[]>> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .neq('balance', 0)
        .order('balance', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error getting customers with balance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Email validation helper
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

