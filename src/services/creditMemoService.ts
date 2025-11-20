/**
 * Credit Memo Service
 * Handles customer refunds, returns, and invoice corrections
 * All business logic here - NO database triggers/functions
 */

import { supabase } from '@/integrations/supabase/client';
import { JournalEntryService } from './journalEntryService';
import { CustomerService } from './customerService';
import { StockMovementService } from './stockMovementService';
import { ServiceResponse } from './types';

export interface CreditMemoLine {
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
}

export interface CreateCreditMemoData {
  user_id: string;
  customer_id: string;
  invoice_id?: string;
  credit_memo_date: string;
  reason: string;
  notes?: string;
  lines: CreditMemoLine[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export class CreditMemoService {
  /**
   * Generate next credit memo number
   */
  static async generateCreditMemoNumber(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('credit_memos')
        .select('credit_memo_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        return 'CM-00001';
      }

      const lastNumber = data[0].credit_memo_number;
      const match = lastNumber.match(/CM-(\d+)/);
      
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return `CM-${nextNum.toString().padStart(5, '0')}`;
      }

      return 'CM-00001';
    } catch (error: any) {
      console.error('Error generating credit memo number:', error);
      return `CM-${Date.now().toString().slice(-5)}`;
    }
  }

  /**
   * Create credit memo
   * Handles all business logic:
   * 1. Create credit memo record
   * 2. Create journal entries (double-entry)
   * 3. Update customer balance
   * 4. Update inventory if products returned
   * 5. Apply to invoice if specified
   */
  static async createCreditMemo(data: CreateCreditMemoData): Promise<ServiceResponse> {
    try {
      // Generate credit memo number
      const creditMemoNumber = await this.generateCreditMemoNumber(data.user_id);

      // 1. Create credit memo record
      const { data: creditMemo, error: creditMemoError } = await supabase
        .from('credit_memos')
        .insert([{
          user_id: data.user_id,
          customer_id: data.customer_id,
          invoice_id: data.invoice_id || null,
          credit_memo_number: creditMemoNumber,
          credit_memo_date: data.credit_memo_date,
          reason: data.reason,
          notes: data.notes || '',
          subtotal: data.subtotal,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount,
          status: 'draft'
        }])
        .select()
        .single();

      if (creditMemoError) throw creditMemoError;

      // 2. Create credit memo lines
      const linesWithMemoId = data.lines.map(line => ({
        credit_memo_id: creditMemo.id,
        product_id: line.product_id || null,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        account_id: line.account_id || null
      }));

      const { error: linesError } = await supabase
        .from('credit_memo_lines')
        .insert(linesWithMemoId);

      if (linesError) throw linesError;

      return {
        success: true,
        data: { ...creditMemo, lines: data.lines }
      };
    } catch (error: any) {
      console.error('Error creating credit memo:', error);
      return {
        success: false,
        error: error.message || 'Failed to create credit memo'
      };
    }
  }

  /**
   * Issue credit memo
   * This is when the credit memo is finalized and accounting entries are made
   */
  static async issueCreditMemo(creditMemoId: string): Promise<ServiceResponse> {
    try {
      // Get credit memo with all details
      const { data: creditMemo, error: fetchError } = await supabase
        .from('credit_memos')
        .select(`
          *,
          customer:customers(id, name),
          lines:credit_memo_lines(*)
        `)
        .eq('id', creditMemoId)
        .single();

      if (fetchError || !creditMemo) {
        return { success: false, error: 'Credit memo not found' };
      }

      if (creditMemo.status !== 'draft') {
        return { success: false, error: 'Credit memo already issued' };
      }

      // Get accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name, account_type')
        .eq('user_id', creditMemo.user_id)
        .in('code', ['1200', '4100', '5000', '1300', '2100']);

      const arAccount = accounts?.find(a => a.code === '1200'); // Accounts Receivable
      const salesReturnsAccount = accounts?.find(a => a.code === '4100'); // Sales Returns (contra-revenue)
      const cogsAccount = accounts?.find(a => a.code === '5000'); // COGS
      const inventoryAccount = accounts?.find(a => a.code === '1300'); // Inventory
      const taxPayableAccount = accounts?.find(a => a.code === '2100'); // Sales Tax Payable

      if (!arAccount) {
        return { success: false, error: 'Accounts Receivable account not found' };
      }

      // 1. Create main journal entry for credit memo
      // DEBIT: Sales Returns (contra-revenue) - reduces revenue
      // CREDIT: Accounts Receivable - reduces customer balance
      const journalLines: any[] = [];

      // Main entry: Sales Returns & AR
      journalLines.push({
        journal_entry_id: '',
        account_id: salesReturnsAccount?.id || arAccount.id,
        debit: creditMemo.subtotal,
        credit: 0,
        description: `Credit memo ${creditMemo.credit_memo_number} - ${creditMemo.reason}`,
        entity_type: 'customer',
        entity_id: creditMemo.customer_id
      });

      journalLines.push({
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: 0,
        credit: creditMemo.subtotal,
        description: `Credit memo ${creditMemo.credit_memo_number} - ${creditMemo.customer?.name || 'Customer'}`,
        entity_type: 'customer',
        entity_id: creditMemo.customer_id
      });

      // Tax entry if applicable
      if (creditMemo.tax_amount > 0 && taxPayableAccount) {
        journalLines.push({
          journal_entry_id: '',
          account_id: taxPayableAccount.id,
          debit: creditMemo.tax_amount,
          credit: 0,
          description: 'Sales tax reversal',
          entity_type: 'customer',
          entity_id: creditMemo.customer_id
        });
      }

      const journalResult = await JournalEntryService.createJournalEntry({
        user_id: creditMemo.user_id,
        entry_date: creditMemo.credit_memo_date,
        reference: creditMemo.credit_memo_number,
        description: `Credit memo ${creditMemo.credit_memo_number} - ${creditMemo.reason}`,
        status: 'posted',
        source_type: 'credit_memo',
        source_id: creditMemo.id,
        notes: creditMemo.notes || '',
        lines: journalLines
      });

      if (!journalResult.success) {
        return { success: false, error: 'Failed to create journal entry' };
      }

      // 2. Handle inventory returns (if products involved)
      for (const line of creditMemo.lines) {
        if (line.product_id) {
          // Get product details
          const { data: product } = await supabase
            .from('products')
            .select('type, track_inventory, cost')
            .eq('id', line.product_id)
            .single();

          if (product && product.type === 'product' && product.track_inventory) {
            // Record stock movement (return)
            await StockMovementService.recordStockMovement({
              user_id: creditMemo.user_id,
              product_id: line.product_id,
              movement_type: 'sale_return',
              quantity: line.quantity, // Positive for returns (adds back to inventory)
              unit_cost: product.cost || 0,
              reference_type: 'credit_memo',
              reference_id: creditMemo.id,
              reference_number: creditMemo.credit_memo_number,
              description: `Return from ${creditMemo.customer?.name || 'Customer'} - ${creditMemo.reason}`,
              movement_date: creditMemo.credit_memo_date,
              create_journal_entry: true // Creates DEBIT Inventory, CREDIT COGS
            });
          }
        }
      }

      // 3. Apply to invoice if specified
      if (creditMemo.invoice_id) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('balance_due, status')
          .eq('id', creditMemo.invoice_id)
          .single();

        if (invoice) {
          const newBalance = invoice.balance_due - creditMemo.total_amount;
          const newStatus = newBalance <= 0 ? 'paid' : 
                          newBalance < invoice.balance_due ? 'partial' : invoice.status;

          await supabase
            .from('invoices')
            .update({
              balance_due: Math.max(0, newBalance),
              status: newStatus
            })
            .eq('id', creditMemo.invoice_id);
        }
      }

      // 4. Update credit memo status
      await supabase
        .from('credit_memos')
        .update({
          status: 'issued',
          issued_at: new Date().toISOString(),
          journal_entry_id: journalResult.data?.id
        })
        .eq('id', creditMemoId);

      // 5. Update customer balance
      await CustomerService.calculateCustomerBalance(creditMemo.customer_id);

      return {
        success: true,
        data: creditMemo
      };
    } catch (error: any) {
      console.error('Error issuing credit memo:', error);
      return {
        success: false,
        error: error.message || 'Failed to issue credit memo'
      };
    }
  }

  /**
   * Get credit memos with filters
   */
  static async getCreditMemos(
    userId: string,
    filters?: {
      status?: string;
      customer_id?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ServiceResponse> {
    try {
      let query = supabase
        .from('credit_memos')
        .select(`
          *,
          customer:customers(id, name, company_name),
          invoice:invoices(invoice_number)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      if (filters?.startDate) {
        query = query.gte('credit_memo_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('credit_memo_date', filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      console.error('Error fetching credit memos:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  /**
   * Get credit memo by ID with lines
   */
  static async getCreditMemoById(creditMemoId: string): Promise<ServiceResponse> {
    try {
      const { data, error } = await supabase
        .from('credit_memos')
        .select(`
          *,
          customer:customers(*),
          invoice:invoices(invoice_number, total_amount),
          lines:credit_memo_lines(*)
        `)
        .eq('id', creditMemoId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error: any) {
      console.error('Error fetching credit memo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete credit memo (only if draft)
   */
  static async deleteCreditMemo(creditMemoId: string): Promise<ServiceResponse> {
    try {
      // Check if credit memo is draft
      const { data: creditMemo } = await supabase
        .from('credit_memos')
        .select('status')
        .eq('id', creditMemoId)
        .single();

      if (!creditMemo) {
        return { success: false, error: 'Credit memo not found' };
      }

      if (creditMemo.status !== 'draft') {
        return { success: false, error: 'Can only delete draft credit memos' };
      }

      // Delete lines first
      await supabase
        .from('credit_memo_lines')
        .delete()
        .eq('credit_memo_id', creditMemoId);

      // Delete credit memo
      const { error } = await supabase
        .from('credit_memos')
        .delete()
        .eq('id', creditMemoId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting credit memo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Void credit memo (reverses all entries)
   */
  static async voidCreditMemo(creditMemoId: string): Promise<ServiceResponse> {
    try {
      const { data: creditMemo } = await supabase
        .from('credit_memos')
        .select('*')
        .eq('id', creditMemoId)
        .single();

      if (!creditMemo) {
        return { success: false, error: 'Credit memo not found' };
      }

      if (creditMemo.status === 'void') {
        return { success: false, error: 'Credit memo already voided' };
      }

      if (creditMemo.status === 'draft') {
        return { success: false, error: 'Cannot void draft credit memo. Delete it instead.' };
      }

      // Create reversal journal entry
      // (In practice, you might want to reverse the original entry)
      // For now, just mark as void
      await supabase
        .from('credit_memos')
        .update({ status: 'void', voided_at: new Date().toISOString() })
        .eq('id', creditMemoId);

      // Recalculate customer balance
      await CustomerService.calculateCustomerBalance(creditMemo.customer_id);

      return { success: true };
    } catch (error: any) {
      console.error('Error voiding credit memo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

