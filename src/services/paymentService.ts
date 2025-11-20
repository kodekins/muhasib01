/**
 * Payment Service
 * Handles payment recording and tracking
 * All business logic in application code
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { JournalEntryService } from './journalEntryService';
import { CustomerService } from './customerService';
import { VendorService } from './vendorService';
import { TransactionIntegrationService } from './transactionIntegrationService';

interface Payment {
  id: string;
  user_id: string;
  payment_type: string;
  customer_id?: string;
  vendor_id?: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
  bank_account_id?: string;
  status: string;
  created_at: string;
}

export class PaymentService {
  /**
   * Record invoice payment
   * Business logic: Updates invoice balance, creates journal entry
   */
  static async recordInvoicePayment(
    invoiceId: string,
    paymentData: {
      amount: number;
      payment_date: string;
      payment_method: string;
      bank_account_id?: string;
      reference_number?: string;
      notes?: string;
    }
  ): Promise<ServiceResponse<Payment>> {
    try {
      // Get invoice details
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customers(name)')
        .eq('id', invoiceId)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          error: 'Invoice not found'
        };
      }

      // Validation: Payment amount cannot exceed balance due
      if (paymentData.amount > invoice.balance_due) {
        return {
          success: false,
          error: `Payment amount ($${paymentData.amount}) exceeds balance due ($${invoice.balance_due})`
        };
      }

      // Validation: Payment amount must be positive
      if (paymentData.amount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be positive'
        };
      }

      // Create payment record (without invoice_id - will use payment_applications)
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          user_id: invoice.user_id,
          customer_id: invoice.customer_id,
          payment_type: 'invoice_payment',
          payment_date: paymentData.payment_date,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method,
          bank_account_id: paymentData.bank_account_id,
          reference_number: paymentData.reference_number,
          notes: paymentData.notes,
          status: 'completed'
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Link payment to invoice via payment_applications table
      const { error: applicationError } = await supabase
        .from('payment_applications')
        .insert([{
          payment_id: payment.id,
          invoice_id: invoiceId,
          amount_applied: paymentData.amount
        }]);

      if (applicationError) throw applicationError;

      // Business logic: Calculate new balance
      const newBalance = invoice.balance_due - paymentData.amount;
      
      // Determine new status based on balance
      let newStatus = invoice.status;
      if (newBalance === 0) {
        newStatus = 'paid';
      } else if (newBalance < invoice.total_amount) {
        newStatus = 'partial';
      }

      // Update invoice
      await supabase
        .from('invoices')
        .update({
          balance_due: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

      // Get required accounts for journal entry
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', invoice.user_id)
        .in('code', ['1010', '1200']); // Bank Account and Accounts Receivable

      const bankAccount = accounts?.find(a => a.code === '1010');
      const arAccount = accounts?.find(a => a.code === '1200');

      // Create journal entry for payment
      // Debit: Cash/Bank Account (increase asset)
      // Credit: Accounts Receivable (decrease asset)
      if (bankAccount && arAccount) {
        const journalResult = await JournalEntryService.createJournalEntry({
          user_id: invoice.user_id,
          entry_date: paymentData.payment_date,
          description: `Payment received for ${invoice.invoice_number} - ${invoice.customers?.name || 'Customer'}`,
          status: 'posted',
          source_type: 'payment',
          source_id: payment.id,
          reference: paymentData.reference_number || payment.id,
          notes: `Payment for invoice ${invoice.invoice_number}\nMethod: ${paymentData.payment_method}\n${paymentData.notes || ''}`,
          lines: [
            {
              journal_entry_id: '',
              account_id: paymentData.bank_account_id || bankAccount.id,
              debit: paymentData.amount,
              credit: 0,
              description: `Payment received - ${paymentData.payment_method}`,
              entity_type: 'customer',
              entity_id: invoice.customer_id
            },
            {
              journal_entry_id: '',
              account_id: arAccount.id,
              debit: 0,
              credit: paymentData.amount,
              description: `Invoice ${invoice.invoice_number} payment`,
              entity_type: 'customer',
              entity_id: invoice.customer_id
            }
          ]
        });

        if (!journalResult.success) {
          console.warn('Journal entry creation failed:', journalResult.error);
        }
      } else {
        console.warn('Required accounts not found for payment journal entry');
      }

      // Update customer balance after payment
      await CustomerService.calculateCustomerBalance(invoice.customer_id);

      // Record transaction for payment received
      await TransactionIntegrationService.recordInvoicePaymentTransaction(payment.id, invoiceId);

      return {
        success: true,
        data: payment,
        message: `Payment of $${paymentData.amount} recorded successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to record payment'
      };
    }
  }

  /**
   * Record bill payment
   * Business logic: Updates bill balance, creates journal entry
   */
  static async recordBillPayment(
    billId: string,
    paymentData: {
      amount: number;
      payment_date: string;
      payment_method: string;
      bank_account_id?: string;
      reference_number?: string;
      notes?: string;
    }
  ): Promise<ServiceResponse<Payment>> {
    try {
      // Get bill details
      const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('*, vendors(name)')
        .eq('id', billId)
        .single();

      if (billError || !bill) {
        return {
          success: false,
          error: 'Bill not found'
        };
      }

      // Validation: Payment amount cannot exceed balance due
      if (paymentData.amount > bill.balance_due) {
        return {
          success: false,
          error: `Payment amount ($${paymentData.amount}) exceeds balance due ($${bill.balance_due})`
        };
      }

      // Validation: Payment amount must be positive
      if (paymentData.amount <= 0) {
        return {
          success: false,
          error: 'Payment amount must be positive'
        };
      }

      // Create payment record (without bill_id - will use payment_applications)
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert([{
          user_id: bill.user_id,
          vendor_id: bill.vendor_id,
          payment_type: 'bill_payment',
          payment_date: paymentData.payment_date,
          amount: paymentData.amount,
          payment_method: paymentData.payment_method,
          bank_account_id: paymentData.bank_account_id,
          reference_number: paymentData.reference_number,
          notes: paymentData.notes,
          status: 'completed'
        }])
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Link payment to bill via payment_applications table
      const { error: applicationError } = await supabase
        .from('payment_applications')
        .insert([{
          payment_id: payment.id,
          bill_id: billId,
          amount_applied: paymentData.amount
        }]);

      if (applicationError) throw applicationError;

      // Business logic: Calculate new balance
      const newBalance = bill.balance_due - paymentData.amount;
      
      // Determine new status
      let newStatus = bill.status;
      if (newBalance === 0) {
        newStatus = 'paid';
      } else if (newBalance < bill.total_amount) {
        newStatus = 'partial';
      }

      // Update bill
      await supabase
        .from('bills')
        .update({
          balance_due: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', billId);

      // Get required accounts for journal entry
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', bill.user_id)
        .in('code', ['1010', '2000']); // Bank Account and Accounts Payable

      const bankAccount = accounts?.find(a => a.code === '1010');
      const apAccount = accounts?.find(a => a.code === '2000');

      // Create journal entry for payment
      // Debit: Accounts Payable (decrease liability)
      // Credit: Cash/Bank Account (decrease asset)
      if (bankAccount && apAccount) {
        const journalResult = await JournalEntryService.createJournalEntry({
          user_id: bill.user_id,
          entry_date: paymentData.payment_date,
          description: `Payment made for ${bill.bill_number} - ${bill.vendors?.name || 'Vendor'}`,
          status: 'posted',
          source_type: 'payment',
          source_id: payment.id,
          reference: paymentData.reference_number || payment.id,
          notes: `Payment for bill ${bill.bill_number}\nMethod: ${paymentData.payment_method}\n${paymentData.notes || ''}`,
          lines: [
            {
              journal_entry_id: '',
              account_id: apAccount.id,
              debit: paymentData.amount,
              credit: 0,
              description: `Bill ${bill.bill_number} payment`,
              entity_type: 'vendor',
              entity_id: bill.vendor_id
            },
            {
              journal_entry_id: '',
              account_id: paymentData.bank_account_id || bankAccount.id,
              debit: 0,
              credit: paymentData.amount,
              description: `Payment made - ${paymentData.payment_method}`,
              entity_type: 'vendor',
              entity_id: bill.vendor_id
            }
          ]
        });

        if (!journalResult.success) {
          console.warn('Journal entry creation failed:', journalResult.error);
        }
      } else {
        console.warn('Required accounts not found for payment journal entry');
      }

      // Update vendor balance after payment
      await VendorService.calculateVendorBalance(bill.vendor_id);

      // Record transaction for payment made
      await TransactionIntegrationService.recordBillPaymentTransaction(payment.id, billId);

      return {
        success: true,
        data: payment,
        message: `Payment of $${paymentData.amount} recorded successfully`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to record payment'
      };
    }
  }

  /**
   * Get payments for an invoice
   */
  static async getInvoicePayments(invoiceId: string): Promise<ServiceResponse<Payment[]>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch payments'
      };
    }
  }

  /**
   * Get payments for a bill
   */
  static async getBillPayments(billId: string): Promise<ServiceResponse<Payment[]>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('bill_id', billId)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch payments'
      };
    }
  }

  /**
   * Get all payments for a user with filters
   */
  static async getPayments(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      payment_method?: string;
      type?: 'invoice' | 'bill';
    }
  ): Promise<ServiceResponse<Payment[]>> {
    try {
      let query = supabase
        .from('payments')
        .select('*, invoices(invoice_number), bills(bill_number)')
        .eq('user_id', userId)
        .order('payment_date', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('payment_date', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('payment_date', filters.endDate);
      }

      if (filters?.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }

      if (filters?.type === 'invoice') {
        query = query.not('invoice_id', 'is', null);
      }

      if (filters?.type === 'bill') {
        query = query.not('bill_id', 'is', null);
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
        error: error.message || 'Failed to fetch payments'
      };
    }
  }

  /**
   * Calculate total payments for a period
   * Business logic: Aggregates payment data
   */
  static async getPaymentSummary(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResponse<{
    total_received: number;
    total_paid: number;
    net_cash_flow: number;
    invoice_payment_count: number;
    bill_payment_count: number;
  }>> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('amount, invoice_id, bill_id')
        .eq('user_id', userId)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (error) throw error;

      // Calculate in application code
      let total_received = 0;
      let total_paid = 0;
      let invoice_payment_count = 0;
      let bill_payment_count = 0;

      data?.forEach(payment => {
        if (payment.invoice_id) {
          total_received += payment.amount;
          invoice_payment_count++;
        }
        if (payment.bill_id) {
          total_paid += payment.amount;
          bill_payment_count++;
        }
      });

      const net_cash_flow = total_received - total_paid;

      return {
        success: true,
        data: {
          total_received,
          total_paid,
          net_cash_flow,
          invoice_payment_count,
          bill_payment_count
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to calculate payment summary'
      };
    }
  }
}

