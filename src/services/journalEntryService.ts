/**
 * Journal Entry Service
 * Handles double-entry bookkeeping with journal entries
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';

export interface JournalEntry {
  id?: string;
  user_id: string;
  entry_number?: string;
  entry_date: string;
  reference?: string;
  description: string;
  status: 'draft' | 'posted' | 'void';
  source_type?: string;
  source_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
  entity_type?: string;
  entity_id?: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalEntryLine[];
}

export class JournalEntryService {
  /**
   * Validate journal entry - must balance (debits = credits)
   */
  static validateJournalEntry(entry: JournalEntryWithLines): ServiceResponse {
    const errors: string[] = [];

    if (!entry.description) {
      errors.push('Description is required');
    }

    if (!entry.lines || entry.lines.length < 2) {
      errors.push('Journal entry must have at least 2 lines');
    }

    // Calculate total debits and credits
    const totalDebits = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredits = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

    // Check if balanced (allow 0.01 difference for rounding)
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      errors.push(
        `Journal entry must balance. Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`
      );
    }

    // Validate each line
    entry.lines.forEach((line, index) => {
      if (!line.account_id) {
        errors.push(`Line ${index + 1}: Account is required`);
      }

      if ((line.debit || 0) === 0 && (line.credit || 0) === 0) {
        errors.push(`Line ${index + 1}: Must have debit or credit amount`);
      }

      if ((line.debit || 0) > 0 && (line.credit || 0) > 0) {
        errors.push(`Line ${index + 1}: Cannot have both debit and credit`);
      }
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }

  /**
   * Create a journal entry with lines
   */
  static async createJournalEntry(
    entry: JournalEntryWithLines
  ): Promise<ServiceResponse<JournalEntry>> {
    try {
      // Validate entry
      const validation = this.validateJournalEntry(entry);
      if (!validation.success) {
        return validation;
      }

      // Generate entry number if not provided
      let entryNumber = entry.entry_number;
      if (!entryNumber) {
        // Get the count of existing entries for this user
        const { count } = await supabase
          .from('journal_entries')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', entry.user_id);
        
        const nextNumber = (count || 0) + 1;
        entryNumber = `JE-${String(nextNumber).padStart(5, '0')}`;
      }

      // Calculate totals
      const total_debits = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
      const total_credits = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0);

      // Create journal entry
      const { data: journalEntry, error: entryError } = await supabase
        .from('journal_entries')
        .insert([{
          user_id: entry.user_id,
          entry_number: entryNumber,
          entry_date: entry.entry_date,
          reference: entry.reference,
          description: entry.description,
          status: entry.status || 'draft',
          source_type: entry.source_type,
          source_id: entry.source_id,
          notes: entry.notes,
          total_debits: total_debits,
          total_credits: total_credits
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      // Create lines
      const lines = entry.lines.map(line => ({
        journal_entry_id: journalEntry.id,
        account_id: line.account_id,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description,
        entity_type: line.entity_type,
        entity_id: line.entity_id
      }));

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lines);

      if (linesError) {
        // Rollback - delete journal entry
        await supabase.from('journal_entries').delete().eq('id', journalEntry.id);
        throw linesError;
      }

      return { success: true, data: journalEntry };
    } catch (error: any) {
      console.error('Error creating journal entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post a journal entry (make it permanent)
   */
  static async postJournalEntry(entryId: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update(withTimestamp({
          status: 'posted',
          posted_at: new Date().toISOString()
        }))
        .eq('id', entryId)
        .eq('status', 'draft'); // Only post draft entries

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error posting journal entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Void a journal entry
   */
  static async voidJournalEntry(entryId: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .update(withTimestamp({
          status: 'void',
          voided_at: new Date().toISOString()
        }))
        .eq('id', entryId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error voiding journal entry:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get journal entries with lines
   */
  static async getJournalEntries(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      status?: string;
      accountId?: string;
    }
  ): Promise<ServiceResponse<JournalEntryWithLines[]>> {
    try {
      let query = supabase
        .from('journal_entries')
        .select(`
          *,
          lines:journal_entry_lines(*, account:accounts(name, code))
        `)
        .eq('user_id', userId);

      if (filters?.startDate) {
        query = query.gte('entry_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('entry_date', filters.endDate);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      query = query.order('entry_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching journal entries:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create journal entry from invoice (Revenue recognition)
   */
  static async createJournalEntryFromInvoice(
    userId: string,
    invoiceId: string,
    invoiceData: {
      customer_id: string;
      total_amount: number;
      tax_amount: number;
      subtotal: number;
      discount_amount?: number;
      invoice_number: string;
      invoice_date: string;
    }
  ): Promise<ServiceResponse<JournalEntry>> {
    try {
      // Get the invoice with line items to create detailed entries
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*, account:accounts(id, name, code))')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      // Get required accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name, account_type')
        .eq('user_id', userId)
        .in('code', ['1200', '2100', '4000', '4100']); // AR, Sales Tax Payable, Revenue, Sales Discounts

      const arAccount = accounts?.find(a => a.code === '1200');
      const taxPayableAccount = accounts?.find(a => a.code === '2100');
      const defaultRevenueAccount = accounts?.find(a => a.code === '4000');
      const salesDiscountsAccount = accounts?.find(a => a.code === '4100');

      if (!arAccount || !defaultRevenueAccount) {
        return {
          success: false,
          error: 'Required accounts not found. Please set up Accounts Receivable (1200) and Revenue (4000).'
        };
      }

      // Start building journal entry lines
      const journalLines: any[] = [];

      // DEBIT: Accounts Receivable (full invoice amount)
      journalLines.push({
        journal_entry_id: '',
        account_id: arAccount.id,
        debit: invoiceData.total_amount,
        credit: 0,
        description: `AR - ${invoice.invoice_number}`,
        entity_type: 'customer',
        entity_id: invoiceData.customer_id
      });

      // CREDIT: Revenue for each line item (using line-specific accounts if available)
      if (invoice.lines && invoice.lines.length > 0) {
        // Group lines by account to combine amounts
        const revenueByAccount = new Map<string, { account_id: string; amount: number; description: string }>();

        for (const line of invoice.lines) {
          const lineAmount = line.quantity * line.unit_price * (1 - (line.discount_percent || 0) / 100);
          const accountId = line.account_id || defaultRevenueAccount.id;
          const accountName = line.account?.name || defaultRevenueAccount.name;

          if (revenueByAccount.has(accountId)) {
            const existing = revenueByAccount.get(accountId)!;
            existing.amount += lineAmount;
          } else {
            revenueByAccount.set(accountId, {
              account_id: accountId,
              amount: lineAmount,
              description: `Revenue - ${accountName}`
            });
          }
        }

        // Add revenue lines
        for (const revenueEntry of revenueByAccount.values()) {
          journalLines.push({
            journal_entry_id: '',
            account_id: revenueEntry.account_id,
            debit: 0,
            credit: revenueEntry.amount,
            description: revenueEntry.description
          });
        }
      } else {
        // Fallback: single revenue line
        journalLines.push({
          journal_entry_id: '',
          account_id: defaultRevenueAccount.id,
          debit: 0,
          credit: invoiceData.subtotal - (invoiceData.discount_amount || 0),
          description: 'Revenue'
        });
      }

      // CREDIT: Sales Tax Payable (if applicable)
      if (invoiceData.tax_amount > 0 && taxPayableAccount) {
        journalLines.push({
          journal_entry_id: '',
          account_id: taxPayableAccount.id,
          debit: 0,
          credit: invoiceData.tax_amount,
          description: 'Sales Tax Collected'
        });
      }

      // DEBIT: Sales Discounts (if applicable)
      if (invoiceData.discount_amount && invoiceData.discount_amount > 0 && salesDiscountsAccount) {
        journalLines.push({
          journal_entry_id: '',
          account_id: salesDiscountsAccount.id,
          debit: invoiceData.discount_amount,
          credit: 0,
          description: 'Sales Discount Applied'
        });
      }

      // Create journal entry with detailed lines
      const entry: JournalEntryWithLines = {
        user_id: userId,
        entry_date: invoiceData.invoice_date,
        reference: invoiceData.invoice_number,
        description: `Invoice ${invoiceData.invoice_number} - Revenue recognition`,
        status: 'posted',
        source_type: 'invoice',
        source_id: invoiceId,
        notes: `Automatic entry for invoice ${invoiceData.invoice_number}\nCustomer: ${invoiceData.customer_id}\nTotal: $${invoiceData.total_amount.toFixed(2)}`,
        lines: journalLines
      };

      return await this.createJournalEntry(entry);
    } catch (error: any) {
      console.error('Error creating journal entry from invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create journal entry from bill (Expense recognition)
   */
  static async createJournalEntryFromBill(
    userId: string,
    billId: string,
    billData: {
      vendor_id: string;
      total_amount: number;
      subtotal: number;
      bill_number: string;
      bill_date: string;
    }
  ): Promise<ServiceResponse<JournalEntry>> {
    try {
      // Get accounts payable and expense accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, account_type')
        .eq('user_id', userId)
        .in('code', ['2000', '5000']); // AP and Expenses

      const apAccount = accounts?.find(a => a.code === '2000');
      const expenseAccount = accounts?.find(a => a.code === '5000');

      if (!apAccount || !expenseAccount) {
        return {
          success: false,
          error: 'Required accounts not found. Please set up Accounts Payable (2000) and Expenses (5000).'
        };
      }

      // Create journal entry
      const entry: JournalEntryWithLines = {
        user_id: userId,
        entry_date: billData.bill_date,
        reference: billData.bill_number,
        description: `Bill ${billData.bill_number} - Expense recognition`,
        status: 'posted',
        source_type: 'bill',
        source_id: billId,
        lines: [
          {
            journal_entry_id: '',
            account_id: expenseAccount.id,
            debit: billData.total_amount,
            credit: 0,
            description: 'Expense'
          },
          {
            journal_entry_id: '',
            account_id: apAccount.id,
            debit: 0,
            credit: billData.total_amount,
            description: 'Accounts Payable',
            entity_type: 'vendor',
            entity_id: billData.vendor_id
          }
        ]
      };

      return await this.createJournalEntry(entry);
    } catch (error: any) {
      console.error('Error creating journal entry from bill:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create journal entry from payment
   */
  static async createJournalEntryFromPayment(
    userId: string,
    paymentId: string,
    paymentData: {
      payment_type: string;
      amount: number;
      bank_account_id: string;
      customer_id?: string;
      vendor_id?: string;
      payment_date: string;
      payment_number?: string;
    }
  ): Promise<ServiceResponse<JournalEntry>> {
    try {
      const lines: JournalEntryLine[] = [];
      let description = '';

      if (paymentData.payment_type === 'invoice_payment') {
        // Customer payment received
        // DR: Cash/Bank
        // CR: Accounts Receivable
        const { data: arAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('code', '1200')
          .single();

        if (!arAccount) {
          return { success: false, error: 'Accounts Receivable account not found' };
        }

        lines.push(
          {
            journal_entry_id: '',
            account_id: paymentData.bank_account_id,
            debit: paymentData.amount,
            credit: 0,
            description: 'Cash received'
          },
          {
            journal_entry_id: '',
            account_id: arAccount.id,
            debit: 0,
            credit: paymentData.amount,
            description: 'Accounts Receivable',
            entity_type: 'customer',
            entity_id: paymentData.customer_id
          }
        );

        description = `Payment received ${paymentData.payment_number || ''}`;
      } else if (paymentData.payment_type === 'bill_payment') {
        // Payment to vendor
        // DR: Accounts Payable
        // CR: Cash/Bank
        const { data: apAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('code', '2000')
          .single();

        if (!apAccount) {
          return { success: false, error: 'Accounts Payable account not found' };
        }

        lines.push(
          {
            journal_entry_id: '',
            account_id: apAccount.id,
            debit: paymentData.amount,
            credit: 0,
            description: 'Accounts Payable',
            entity_type: 'vendor',
            entity_id: paymentData.vendor_id
          },
          {
            journal_entry_id: '',
            account_id: paymentData.bank_account_id,
            debit: 0,
            credit: paymentData.amount,
            description: 'Cash paid'
          }
        );

        description = `Payment made ${paymentData.payment_number || ''}`;
      }

      const entry: JournalEntryWithLines = {
        user_id: userId,
        entry_date: paymentData.payment_date,
        reference: paymentData.payment_number,
        description,
        status: 'posted',
        source_type: 'payment',
        source_id: paymentId,
        lines
      };

      return await this.createJournalEntry(entry);
    } catch (error: any) {
      console.error('Error creating journal entry from payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get general ledger (all posted transactions by account)
   */
  static async getGeneralLedger(
    userId: string,
    accountId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entry:journal_entries(entry_number, entry_date, description, reference, status),
          account:accounts(name, code, account_type)
        `)
        .eq('journal_entry.user_id', userId)
        .eq('journal_entry.status', 'posted')
        .order('journal_entry.entry_date', { ascending: true });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate running balance
      let balance = 0;
      const ledger = (data || []).map(line => {
        balance += (line.debit || 0) - (line.credit || 0);
        return {
          ...line,
          balance
        };
      });

      return { success: true, data: ledger };
    } catch (error: any) {
      console.error('Error fetching general ledger:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get trial balance (all account balances)
   */
  static async getTrialBalance(
    userId: string,
    asOfDate?: string
  ): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase.rpc('get_trial_balance', {
        p_user_id: userId,
        p_as_of_date: asOfDate || new Date().toISOString().split('T')[0]
      });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      // If stored procedure doesn't exist, calculate manually
      console.log('Calculating trial balance manually...');
      
      const ledger = await this.getGeneralLedger(userId, undefined, undefined, asOfDate);
      
      if (!ledger.success || !ledger.data) {
        return ledger;
      }

      // Group by account and sum debits/credits
      const accountBalances: { [key: string]: any } = {};
      
      ledger.data.forEach((line: any) => {
        const accountId = line.account_id;
        if (!accountBalances[accountId]) {
          accountBalances[accountId] = {
            account_id: accountId,
            account_name: line.account?.name,
            account_code: line.account?.code,
            account_type: line.account?.account_type,
            debit: 0,
            credit: 0
          };
        }
        accountBalances[accountId].debit += line.debit || 0;
        accountBalances[accountId].credit += line.credit || 0;
      });

      const trialBalance = Object.values(accountBalances).map(account => ({
        ...account,
        balance: account.debit - account.credit
      }));

      return { success: true, data: trialBalance };
    }
  }
}

