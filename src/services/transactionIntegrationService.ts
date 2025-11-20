/**
 * Transaction Integration Service
 * Automatically creates transaction records for all accounting events
 * Ensures proper double-entry bookkeeping and audit trail
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';

export class TransactionIntegrationService {
  /**
   * Record transaction for invoice sent
   * Type: Revenue/Receivable
   */
  static async recordInvoiceSentTransaction(
    invoiceId: string
  ): Promise<ServiceResponse> {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, customer:customers(name)')
        .eq('id', invoiceId)
        .single();

      if (error || !invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Get Accounts Receivable account
      const { data: arAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', invoice.user_id)
        .eq('code', '1200')
        .single();

      if (!arAccount) {
        console.warn('Accounts Receivable account not found');
        return { success: true }; // Don't block the invoice
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: invoice.user_id,
          account_id: arAccount.id,
          customer_id: invoice.customer_id,
          description: `Invoice ${invoice.invoice_number} - ${invoice.customer?.name || 'Customer'}`,
          amount: invoice.total_amount,
          transaction_date: invoice.invoice_date,
          transaction_type: 'invoice',
          reference_id: invoice.id,
          reference_number: invoice.invoice_number,
          status: 'posted',
          notes: invoice.notes
        }]);

      if (transactionError) {
        console.error('Transaction creation failed:', transactionError);
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recording invoice transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record transaction for invoice payment received
   * Type: Cash Receipt
   */
  static async recordInvoicePaymentTransaction(
    paymentId: string,
    invoiceId: string
  ): Promise<ServiceResponse> {
    try {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        return { success: false, error: 'Payment not found' };
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('invoice_number, customer:customers(name)')
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      // Get Bank Account
      const { data: bankAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('code', '1010')
        .single();

      if (!bankAccount) {
        console.warn('Bank Account not found');
        return { success: true };
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: payment.user_id,
          account_id: bankAccount.id,
          customer_id: payment.customer_id,
          description: `Payment received for ${invoice.invoice_number} - ${invoice.customer?.name || 'Customer'}`,
          amount: payment.amount,
          transaction_date: payment.payment_date,
          transaction_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.reference_number || invoice.invoice_number,
          status: 'posted',
          notes: `${payment.payment_method} payment\n${payment.notes || ''}`
        }]);

      if (transactionError) {
        console.error('Transaction creation failed:', transactionError);
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recording payment transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record transaction for bill approved
   * Type: Expense/Payable
   */
  static async recordBillApprovedTransaction(
    billId: string
  ): Promise<ServiceResponse> {
    try {
      const { data: bill, error } = await supabase
        .from('bills')
        .select('*, vendor:vendors(name)')
        .eq('id', billId)
        .single();

      if (error || !bill) {
        return { success: false, error: 'Bill not found' };
      }

      // Get Accounts Payable account
      const { data: apAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', bill.user_id)
        .eq('code', '2000')
        .single();

      if (!apAccount) {
        console.warn('Accounts Payable account not found');
        return { success: true };
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: bill.user_id,
          account_id: apAccount.id,
          vendor_id: bill.vendor_id,
          description: `Bill ${bill.bill_number} - ${bill.vendor?.name || 'Vendor'}`,
          amount: bill.total_amount,
          transaction_date: bill.bill_date,
          transaction_type: 'bill',
          reference_id: bill.id,
          reference_number: bill.bill_number,
          status: 'posted',
          notes: bill.notes
        }]);

      if (transactionError) {
        console.error('Transaction creation failed:', transactionError);
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recording bill transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record transaction for bill payment made
   * Type: Cash Disbursement
   */
  static async recordBillPaymentTransaction(
    paymentId: string,
    billId: string
  ): Promise<ServiceResponse> {
    try {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        return { success: false, error: 'Payment not found' };
      }

      const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('bill_number, vendor:vendors(name)')
        .eq('id', billId)
        .single();

      if (billError || !bill) {
        return { success: false, error: 'Bill not found' };
      }

      // Get Bank Account
      const { data: bankAccount } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('code', '1010')
        .single();

      if (!bankAccount) {
        console.warn('Bank Account not found');
        return { success: true };
      }

      // Create transaction record (negative amount for payment out)
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: payment.user_id,
          account_id: bankAccount.id,
          vendor_id: payment.vendor_id,
          description: `Payment made for ${bill.bill_number} - ${bill.vendor?.name || 'Vendor'}`,
          amount: -payment.amount, // Negative for cash out
          transaction_date: payment.payment_date,
          transaction_type: 'payment',
          reference_id: payment.id,
          reference_number: payment.reference_number || bill.bill_number,
          status: 'posted',
          notes: `${payment.payment_method} payment\n${payment.notes || ''}`
        }]);

      if (transactionError) {
        console.error('Transaction creation failed:', transactionError);
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recording bill payment transaction:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record transaction for journal entry
   * Type: General Journal Entry
   */
  static async recordJournalEntryTransaction(
    journalEntryId: string
  ): Promise<ServiceResponse> {
    try {
      const { data: entry, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('id', journalEntryId)
        .single();

      if (error || !entry) {
        return { success: false, error: 'Journal entry not found' };
      }

      // Get first line's account for the transaction record
      const { data: firstLine } = await supabase
        .from('journal_entry_lines')
        .select('account_id, debit, credit')
        .eq('journal_entry_id', journalEntryId)
        .limit(1)
        .single();

      if (!firstLine) {
        return { success: false, error: 'Journal entry lines not found' };
      }

      // Create transaction record
      const amount = firstLine.debit > 0 ? firstLine.debit : firstLine.credit;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          user_id: entry.user_id,
          account_id: firstLine.account_id,
          description: entry.description,
          amount: amount,
          transaction_date: entry.entry_date,
          transaction_type: 'journal_entry',
          reference_id: entry.id,
          reference_number: entry.reference || entry.entry_number,
          status: entry.status,
          notes: entry.notes
        }]);

      if (transactionError) {
        console.error('Transaction creation failed:', transactionError);
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error recording journal entry transaction:', error);
      return { success: false, error: error.message };
    }
  }
}

