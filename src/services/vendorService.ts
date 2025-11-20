/**
 * Vendor Service
 * Handles vendor-related business logic including balance calculations
 */

import { supabase } from '@/integrations/supabase/client';
import { Vendor, ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';

export class VendorService {
  /**
   * Calculate balance for a specific vendor
   * Positive balance = we owe vendor (accounts payable)
   * Based on outstanding bills (balance_due)
   */
  static async calculateVendorBalance(vendorId: string): Promise<ServiceResponse<number>> {
    try {
      // Get vendor details
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('user_id')
        .eq('id', vendorId)
        .single();

      if (vendorError) throw vendorError;
      if (!vendor) {
        return { success: false, error: 'Vendor not found' };
      }

      // Sum all outstanding bills for this vendor
      const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('balance_due')
        .eq('vendor_id', vendorId)
        .eq('user_id', vendor.user_id)
        .in('status', ['open', 'overdue']); // Only unpaid bills

      if (billsError) throw billsError;

      // Calculate balance (sum of all balance_due amounts)
      const balance = bills?.reduce((sum, bill) => sum + parseFloat(bill.balance_due.toString()), 0) || 0;

      // Update vendor balance
      const { error: updateError } = await supabase
        .from('vendors')
        .update(withTimestamp({ balance: balance }))
        .eq('id', vendorId);

      if (updateError) throw updateError;

      return { success: true, data: balance };
    } catch (error: any) {
      console.error('Error calculating vendor balance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate balances for all vendors of a user
   */
  static async recalculateAllVendorBalances(userId: string): Promise<ServiceResponse<number>> {
    try {
      const { data: vendors, error } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', userId);

      if (error) throw error;

      if (!vendors || vendors.length === 0) {
        return { success: true, data: 0 };
      }

      let updatedCount = 0;
      for (const vendor of vendors) {
        const result = await this.calculateVendorBalance(vendor.id);
        if (result.success) {
          updatedCount++;
        }
      }

      return { success: true, data: updatedCount };
    } catch (error: any) {
      console.error('Error recalculating vendor balances:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create a new vendor with validation
   */
  static async createVendor(vendor: Vendor): Promise<ServiceResponse<Vendor>> {
    try {
      // Validate required fields
      if (!vendor.name || !vendor.user_id) {
        return { success: false, error: 'Name and user_id are required' };
      }

      // Validate email format if provided
      if (vendor.email && !this.isValidEmail(vendor.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const { data, error } = await supabase
        .from('vendors')
        .insert([{
          ...vendor,
          balance: 0 // Initialize balance
        }])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a vendor
   */
  static async updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<ServiceResponse<Vendor>> {
    try {
      // Validate email if being updated
      if (updates.email && !this.isValidEmail(updates.email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const { data, error } = await supabase
        .from('vendors')
        .update(withTimestamp(updates))
        .eq('id', vendorId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating vendor:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get vendors with outstanding balances (amounts we owe)
   */
  static async getVendorsWithBalance(userId: string): Promise<ServiceResponse<Vendor[]>> {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', userId)
        .gt('balance', 0)
        .order('balance', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error getting vendors with balance:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get total amount owed to all vendors
   */
  static async getTotalOwed(userId: string): Promise<ServiceResponse<number>> {
    try {
      const { data: vendors, error } = await supabase
        .from('vendors')
        .select('balance')
        .eq('user_id', userId);

      if (error) throw error;

      const totalOwed = vendors?.reduce((sum, v) => sum + (v.balance || 0), 0) || 0;

      return { success: true, data: totalOwed };
    } catch (error: any) {
      console.error('Error calculating total owed:', error);
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

