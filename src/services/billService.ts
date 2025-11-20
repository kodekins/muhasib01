/**
 * Bill Service
 * Handles vendor bill management and payments
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';
import { JournalEntryService } from './journalEntryService';
import { StockMovementService } from './stockMovementService';
import { VendorService } from './vendorService';
import { TransactionIntegrationService } from './transactionIntegrationService';

export interface Bill {
  id?: string;
  user_id: string;
  vendor_id: string;
  bill_number?: string;
  bill_date: string;
  due_date: string;
  status?: 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid?: number;
  balance_due: number;
  notes?: string;
  terms?: string;
  purchase_order?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BillLine {
  id?: string;
  bill_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
  line_order?: number;
}

export interface BillWithLines extends Bill {
  lines: BillLine[];
  vendor?: any;
}

export class BillService {
  /**
   * Calculate bill totals from lines
   */
  static calculateTotals(lines: BillLine[]): {
    subtotal: number;
    total_amount: number;
  } {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    return { subtotal, total_amount: subtotal };
  }

  /**
   * Generate next bill number
   */
  static async getNextBillNumber(userId: string): Promise<string> {
    try {
      // Get the latest bill number for this user
      const { data: latestBill, error } = await supabase
        .from('bills')
        .select('bill_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" - that's ok for first bill
        console.error('Error fetching latest bill:', error);
      }

      if (latestBill && latestBill.bill_number) {
        // Extract number from bill_number (e.g., "BILL-00001" -> 1)
        const match = latestBill.bill_number.match(/BILL-(\d+)/);
        if (match) {
          const nextNumber = parseInt(match[1], 10) + 1;
          return `BILL-${String(nextNumber).padStart(5, '0')}`;
        }
      }

      // Default to first bill number
      return 'BILL-00001';
    } catch (error) {
      console.error('Error generating bill number:', error);
      // Fallback to timestamp-based bill number to avoid duplicates
      return `BILL-${Date.now()}`;
    }
  }

  /**
   * Validate bill data
   */
  static validateBill(bill: BillWithLines): ServiceResponse {
    const errors: string[] = [];

    if (!bill.vendor_id) errors.push('Vendor is required');
    if (!bill.bill_date) errors.push('Bill date is required');
    if (!bill.due_date) errors.push('Due date is required');
    if (!bill.lines || bill.lines.length === 0) {
      errors.push('Bill must have at least one line item');
    }

    // Validate line items
    bill.lines.forEach((line, index) => {
      if (!line.description) errors.push(`Line ${index + 1}: Description is required`);
      if (line.quantity <= 0) errors.push(`Line ${index + 1}: Quantity must be greater than 0`);
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }

  /**
   * Create a bill with line items
   */
  static async createBill(
    bill: BillWithLines,
    options?: { postJournalEntry?: boolean }
  ): Promise<ServiceResponse<Bill>> {
    try {
      // Validate bill
      const validation = this.validateBill(bill);
      if (!validation.success) {
        return validation;
      }

      // Calculate totals
      const totals = this.calculateTotals(bill.lines);

      // Generate bill number if not provided
      if (!bill.bill_number) {
        bill.bill_number = await this.getNextBillNumber(bill.user_id);
      }

      // Retry logic for duplicate bill numbers (race condition handling)
      let newBill = null;
      let billError = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !newBill) {
        // Create bill
        const result = await supabase
          .from('bills')
          .insert([{
            user_id: bill.user_id,
            vendor_id: bill.vendor_id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            due_date: bill.due_date,
            status: bill.status || 'draft',
            subtotal: totals.subtotal,
            tax_amount: bill.tax_amount || 0,
            total_amount: totals.total_amount + (bill.tax_amount || 0),
            amount_paid: 0,
            balance_due: totals.total_amount + (bill.tax_amount || 0),
            notes: bill.notes,
            terms: bill.terms,
            purchase_order: bill.purchase_order
          }])
          .select()
          .single();

        newBill = result.data;
        billError = result.error;

        // Check if error is due to duplicate bill number
        if (billError && billError.code === '23505' && billError.message.includes('bill_number')) {
          retries++;
          // Generate a new bill number with timestamp to ensure uniqueness
          bill.bill_number = `BILL-${Date.now()}-${retries}`;
          console.log(`Duplicate bill number detected, retrying with: ${bill.bill_number}`);
        } else {
          break; // Exit loop if no duplicate error or success
        }
      }

      if (billError) throw billError;

      // Create line items
      const lines = bill.lines.map((line, index) => ({
        bill_id: newBill.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        account_id: line.account_id,
        line_order: index
      }));

      const { error: linesError } = await supabase
        .from('bill_lines')
        .insert(lines);

      if (linesError) {
        // Rollback - delete bill
        await supabase.from('bills').delete().eq('id', newBill.id);
        throw linesError;
      }

      // Create journal entry if requested
      if (options?.postJournalEntry) {
        const journalResult = await JournalEntryService.createJournalEntryFromBill(
          bill.user_id,
          newBill.id,
          {
            vendor_id: bill.vendor_id,
            total_amount: newBill.total_amount,
            subtotal: totals.subtotal,
            bill_number: bill.bill_number!,
            bill_date: bill.bill_date
          }
        );

        if (journalResult.success && journalResult.data) {
          // Update bill with journal entry reference
          await supabase
            .from('bills')
            .update({ journal_entry_id: journalResult.data.id })
            .eq('id', newBill.id);
        }
      }

      // Update vendor balance
      await VendorService.calculateVendorBalance(bill.vendor_id);

      return { success: true, data: newBill };
    } catch (error: any) {
      console.error('Error creating bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a bill
   */
  static async updateBill(
    billId: string,
    updates: Partial<BillWithLines>
  ): Promise<ServiceResponse<Bill>> {
    try {
      // Get existing bill
      const { data: existing, error: fetchError } = await supabase
        .from('bills')
        .select('*')
        .eq('id', billId)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) {
        return { success: false, error: 'Bill not found' };
      }

      // Can't edit paid or void bills
      if (existing.status === 'paid' || existing.status === 'void') {
        return {
          success: false,
          error: `Cannot edit ${existing.status} bill`
        };
      }

      // If updating lines, recalculate totals
      let billUpdates: any = { ...updates };
      delete billUpdates.lines;
      delete billUpdates.vendor;

      if (updates.lines) {
        const totals = this.calculateTotals(updates.lines);
        billUpdates = {
          ...billUpdates,
          subtotal: totals.subtotal,
          total_amount: totals.total_amount + (updates.tax_amount || 0),
          balance_due: totals.total_amount + (updates.tax_amount || 0) - (existing.amount_paid || 0)
        };

        // Delete old lines and insert new ones
        await supabase.from('bill_lines').delete().eq('bill_id', billId);

        const lines = updates.lines.map((line, index) => ({
          bill_id: billId,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          account_id: line.account_id,
          line_order: index
        }));

        await supabase.from('bill_lines').insert(lines);
      }

      // Update bill
      const { data, error } = await supabase
        .from('bills')
        .update(withTimestamp(billUpdates))
        .eq('id', billId)
        .select()
        .single();

      if (error) throw error;

      // Recalculate vendor balance
      await VendorService.calculateVendorBalance(existing.vendor_id);

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Approve a bill (mark as open)
   */
  static async approveBill(billId: string): Promise<ServiceResponse> {
    try {
      const { data: bill, error: fetchError } = await supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(name)
        `)
        .eq('id', billId)
        .single();

      if (fetchError) throw fetchError;

      // Get bill lines to check for products
      const { data: billLines, error: linesError } = await supabase
        .from('bill_lines')
        .select(`
          *,
          product:products(id, name, type, track_inventory, cost, quantity_on_hand)
        `)
        .eq('bill_id', billId);

      if (linesError) throw linesError;

      // Process product purchases (increase inventory) and create journal entries
      let productTotal = 0;
      let nonProductTotal = 0;

      if (billLines && billLines.length > 0) {
        for (const line of billLines) {
          if (line.product_id && line.product) {
            const product = line.product;
            const lineTotal = line.quantity * line.unit_price;
            productTotal += lineTotal;

            // Only process if it's a trackable product
            if (product.type === 'product' && product.track_inventory) {
              // Record stock movement (purchase) with journal entry
              const movementResult = await StockMovementService.recordStockMovement({
                user_id: bill.user_id,
                product_id: line.product_id,
                movement_type: 'purchase',
                quantity: line.quantity, // Positive for purchase
                unit_cost: line.unit_price,
                reference_type: 'bill',
                reference_id: bill.id,
                reference_number: bill.bill_number,
                description: `Purchase from ${bill.vendor?.name || 'Vendor'}`,
                movement_date: bill.bill_date,
                create_journal_entry: true // Create journal entry: Debit Inventory, Credit A/P
              });

              if (!movementResult.success) {
                console.warn(`Stock movement failed for product ${product.name}:`, movementResult.error);
              }
            }
          } else {
            // Non-product line (expense/service)
            nonProductTotal += line.quantity * line.unit_price;
          }
        }
      }

      // Create journal entry for non-product expenses only
      if (nonProductTotal > 0 && !bill.journal_entry_id) {
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, code')
          .eq('user_id', bill.user_id)
          .in('code', ['2000', '5000']); // AP and Expenses

        const apAccount = accounts?.find(a => a.code === '2000');
        const expenseAccount = accounts?.find(a => a.code === '5000');

        if (apAccount && expenseAccount) {
          const journalResult = await JournalEntryService.createJournalEntry({
            user_id: bill.user_id,
            entry_date: bill.bill_date,
            reference: bill.bill_number,
            description: `Bill ${bill.bill_number} - Expense items`,
            status: 'posted',
            source_type: 'bill',
            source_id: bill.id,
            lines: [
              {
                journal_entry_id: '',
                account_id: expenseAccount.id,
                debit: nonProductTotal,
                credit: 0,
                description: 'Expenses',
                entity_type: 'vendor',
                entity_id: bill.vendor_id
              },
              {
                journal_entry_id: '',
                account_id: apAccount.id,
                debit: 0,
                credit: nonProductTotal,
                description: 'Accounts Payable',
                entity_type: 'vendor',
                entity_id: bill.vendor_id
              }
            ]
          });

          if (journalResult.success && journalResult.data) {
            // Update bill with journal entry reference
            await supabase
              .from('bills')
              .update({ journal_entry_id: journalResult.data.id })
              .eq('id', billId);
          }
        }
      }

      // Update status FIRST (so bill is counted in vendor balance calculation)
      const { error } = await supabase
        .from('bills')
        .update(withTimestamp({
          status: 'open',
          received_at: new Date().toISOString()
        }))
        .eq('id', billId);

      if (error) throw error;

      // Update vendor balance AFTER status change
      await VendorService.calculateVendorBalance(bill.vendor_id);

      // Record transaction for bill approved
      await TransactionIntegrationService.recordBillApprovedTransaction(billId);

      return { 
        success: true,
        message: 'Bill approved, inventory updated, vendor balance increased, and journal entries created'
      };
    } catch (error: any) {
      console.error('Error approving bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Void a bill
   */
  static async voidBill(billId: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase
        .from('bills')
        .update(withTimestamp({
          status: 'void',
          voided_at: new Date().toISOString()
        }))
        .eq('id', billId);

      if (error) throw error;

      // Void related journal entry
      const { data: bill } = await supabase
        .from('bills')
        .select('journal_entry_id, vendor_id')
        .eq('id', billId)
        .single();

      if (bill?.journal_entry_id) {
        await JournalEntryService.voidJournalEntry(bill.journal_entry_id);
      }

      // Recalculate vendor balance
      if (bill?.vendor_id) {
        await VendorService.calculateVendorBalance(bill.vendor_id);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error voiding bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bills with filters
   */
  static async getBills(
    userId: string,
    filters?: {
      vendorId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      overdue?: boolean;
    }
  ): Promise<ServiceResponse<BillWithLines[]>> {
    try {
      let query = supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(name, email, company_name),
          lines:bill_lines(*, product:products(name))
        `)
        .eq('user_id', userId);

      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('bill_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('bill_date', filters.endDate);
      }
      if (filters?.overdue) {
        query = query.lt('due_date', new Date().toISOString().split('T')[0])
          .neq('status', 'paid')
          .neq('status', 'void');
      }

      query = query.order('bill_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching bills:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bill by ID with all details
   */
  static async getBillById(billId: string): Promise<ServiceResponse<BillWithLines>> {
    try {
      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(*),
          lines:bill_lines(*, product:products(*), account:accounts(name))
        `)
        .eq('id', billId)
        .single();

      if (error) throw error;
      if (!data) {
        return { success: false, error: 'Bill not found' };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record a payment against a bill
   */
  static async recordPayment(
    billId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    bankAccountId: string,
    notes?: string
  ): Promise<ServiceResponse> {
    try {
      const { data: bill, error: fetchError } = await supabase
        .from('bills')
        .select('*')
        .eq('id', billId)
        .single();

      if (fetchError) throw fetchError;
      if (!bill) {
        return { success: false, error: 'Bill not found' };
      }

      if (amount > bill.balance_due) {
        return {
          success: false,
          error: `Payment amount ($${amount}) exceeds balance due ($${bill.balance_due})`
        };
      }

      const newAmountPaid = (bill.amount_paid || 0) + amount;
      const newBalanceDue = bill.total_amount - newAmountPaid;
      const newStatus = newBalanceDue === 0 ? 'paid' :
                       newAmountPaid > 0 ? 'partial' : bill.status;

      // Update bill
      const { error: updateError } = await supabase
        .from('bills')
        .update(withTimestamp({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null
        }))
        .eq('id', billId);

      if (updateError) throw updateError;

      // Recalculate vendor balance
      await VendorService.calculateVendorBalance(bill.vendor_id);

      return { success: true };
    } catch (error: any) {
      console.error('Error recording payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get bills due soon
   */
  static async getBillsDueSoon(
    userId: string,
    daysAhead: number = 7
  ): Promise<ServiceResponse<BillWithLines[]>> {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('bills')
        .select(`
          *,
          vendor:vendors(name, email, company_name)
        `)
        .eq('user_id', userId)
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', futureDate.toISOString().split('T')[0])
        .in('status', ['open', 'partial'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching bills due soon:', error);
      return { success: false, error: error.message };
    }
  }
}

