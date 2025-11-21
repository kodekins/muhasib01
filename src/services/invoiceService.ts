/**
 * Invoice Service
 * Handles invoice creation, management, and payments
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';
import { JournalEntryService } from './journalEntryService';
import { CustomerService } from './customerService';
import { InventoryService } from './inventoryService';
import { TransactionIntegrationService } from './transactionIntegrationService';

export interface Invoice {
  id?: string;
  user_id: string;
  customer_id: string;
  document_type?: 'invoice' | 'quotation';
  invoice_number?: string;
  quotation_number?: string;
  invoice_date: string;
  due_date: string;
  status?: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void' | 'accepted' | 'declined';
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  amount_paid?: number;
  balance_due: number;
  notes?: string;
  terms?: string;
  footer?: string;
  purchase_order?: string;
  converted_to_invoice_id?: string;
  converted_from_quotation_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceLine {
  id?: string;
  invoice_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_rate?: number;
  amount: number;
  account_id?: string;
  line_order?: number;
}

export interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[];
  customer?: any;
}

export class InvoiceService {
  /**
   * Calculate invoice totals from lines (line-level discount and tax only)
   */
  static calculateTotals(lines: InvoiceLine[]): {
    subtotal: number;
    tax_amount: number;
    total_amount: number;
  } {
    const subtotal = lines.reduce((sum, line) => {
      const lineAmount = line.quantity * line.unit_price;
      const discountedAmount = lineAmount * (1 - (line.discount_percent || 0) / 100);
      return sum + discountedAmount;
    }, 0);

    const tax_amount = lines.reduce((sum, line) => {
      const lineAmount = line.quantity * line.unit_price;
      const discountedAmount = lineAmount * (1 - (line.discount_percent || 0) / 100);
      const lineTax = discountedAmount * ((line.tax_rate || 0) / 100);
      return sum + lineTax;
    }, 0);

    const total_amount = subtotal + tax_amount; // No invoice-level discount

    return { subtotal, tax_amount, total_amount };
  }

  /**
   * Generate next invoice number
   */
  static async getNextInvoiceNumber(userId: string): Promise<string> {
    try {
      // Get the latest invoice number for this user
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', userId)
        .eq('document_type', 'invoice')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      // Extract number from last invoice and increment
      if (data && data.invoice_number) {
        const match = data.invoice_number.match(/(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          return `INV-${String(nextNum).padStart(5, '0')}`;
        }
      }

      // Default first invoice number
      return 'INV-00001';
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fallback with timestamp to ensure uniqueness
      return `INV-${Date.now().toString().slice(-5)}`;
    }
  }

  /**
   * Generate next quotation number
   */
  static async getNextQuotationNumber(userId: string): Promise<string> {
    try {
      // Get the latest quotation number for this user
      const { data, error } = await supabase
        .from('invoices')
        .select('quotation_number')
        .eq('user_id', userId)
        .eq('document_type', 'quotation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      // Extract number from last quotation and increment
      if (data && data.quotation_number) {
        const match = data.quotation_number.match(/(\d+)$/);
        if (match) {
          const nextNum = parseInt(match[1]) + 1;
          return `QUO-${String(nextNum).padStart(5, '0')}`;
        }
      }

      // Default first quotation number
      return 'QUO-00001';
    } catch (error) {
      console.error('Error generating quotation number:', error);
      // Fallback with timestamp to ensure uniqueness
      return `QUO-${Date.now().toString().slice(-5)}`;
    }
  }

  /**
   * Validate invoice data
   */
  static validateInvoice(invoice: InvoiceWithLines): ServiceResponse {
    const errors: string[] = [];

    if (!invoice.customer_id) errors.push('Customer is required');
    if (!invoice.invoice_date) errors.push('Invoice date is required');
    if (!invoice.due_date) errors.push('Due date is required');
    if (!invoice.lines || invoice.lines.length === 0) {
      errors.push('Invoice must have at least one line item');
    }

    // Validate due date is after invoice date
    if (new Date(invoice.due_date) < new Date(invoice.invoice_date)) {
      errors.push('Due date must be after invoice date');
    }

    // Validate line items
    invoice.lines.forEach((line, index) => {
      if (!line.description) errors.push(`Line ${index + 1}: Description is required`);
      if (line.quantity <= 0) errors.push(`Line ${index + 1}: Quantity must be greater than 0`);
      if (line.unit_price < 0) errors.push(`Line ${index + 1}: Price cannot be negative`);
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }

  /**
   * Create an invoice with line items
   */
  static async createInvoice(
    invoice: InvoiceWithLines,
    options?: { postJournalEntry?: boolean }
  ): Promise<ServiceResponse<Invoice>> {
    try {
      // Validate invoice
      const validation = this.validateInvoice(invoice);
      if (!validation.success) {
        return validation;
      }

      // Calculate totals - use provided values if available, otherwise calculate
      const calculatedTotals = this.calculateTotals(invoice.lines);
      
      // Use provided values if they exist (from UI), otherwise use calculated
      const subtotal = invoice.subtotal !== undefined ? invoice.subtotal : calculatedTotals.subtotal;
      const tax_amount = invoice.tax_amount !== undefined ? invoice.tax_amount : calculatedTotals.tax_amount;
      const total_amount = invoice.total_amount !== undefined ? invoice.total_amount : calculatedTotals.total_amount;

      // Determine document type
      const documentType = invoice.document_type || 'invoice';
      const isQuotation = documentType === 'quotation';

      // Generate document number if not provided
      if (isQuotation && !invoice.quotation_number) {
        invoice.quotation_number = await this.getNextQuotationNumber(invoice.user_id);
      } else if (!isQuotation && !invoice.invoice_number) {
        invoice.invoice_number = await this.getNextInvoiceNumber(invoice.user_id);
      }

      // Create invoice/quotation
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          user_id: invoice.user_id,
          customer_id: invoice.customer_id,
          document_type: documentType,
          invoice_number: isQuotation ? null : invoice.invoice_number,
          quotation_number: isQuotation ? invoice.quotation_number : null,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          status: invoice.status || 'draft',
          subtotal: subtotal,
          tax_amount: tax_amount,
          discount_amount: invoice.discount_amount || 0,
          total_amount: total_amount,
          amount_paid: 0,
          balance_due: isQuotation ? 0 : total_amount, // Quotations don't have balance
          notes: invoice.notes,
          terms: invoice.terms,
          footer: invoice.footer,
          purchase_order: invoice.purchase_order
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create line items
      const lines = invoice.lines.map((line, index) => ({
        invoice_id: newInvoice.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent || 0,
        tax_rate: line.tax_rate || 0,
        amount: line.amount,
        account_id: line.account_id,
        line_order: index
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines);

      if (linesError) {
        // Rollback - delete invoice
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
        throw linesError;
      }

      // Create journal entry if requested (when invoice is sent/finalized)
      // Skip for quotations as they don't affect accounting
      if (options?.postJournalEntry && !isQuotation) {
        const journalResult = await JournalEntryService.createJournalEntryFromInvoice(
          invoice.user_id,
          newInvoice.id,
          {
            customer_id: invoice.customer_id,
            total_amount: totals.total_amount,
            tax_amount: totals.tax_amount,
            subtotal: totals.subtotal,
            invoice_number: invoice.invoice_number!,
            invoice_date: invoice.invoice_date
          }
        );

        if (journalResult.success && journalResult.data) {
          // Update invoice with journal entry reference
          await supabase
            .from('invoices')
            .update({ journal_entry_id: journalResult.data.id })
            .eq('id', newInvoice.id);
        }
      }

      return { success: true, data: newInvoice };
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update an invoice
   */
  static async updateInvoice(
    invoiceId: string,
    updates: Partial<InvoiceWithLines>
  ): Promise<ServiceResponse<Invoice>> {
    try {
      // Get existing invoice
      const { data: existing, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!existing) {
        return { success: false, error: 'Invoice not found' };
      }

      // Can't edit paid or void invoices
      if (existing.status === 'paid' || existing.status === 'void') {
        return {
          success: false,
          error: `Cannot edit ${existing.status} invoice`
        };
      }

      // If updating lines, recalculate totals
      let invoiceUpdates: any = { ...updates };
      delete invoiceUpdates.lines;
      delete invoiceUpdates.customer;

      if (updates.lines) {
        const totals = this.calculateTotals(updates.lines);
        invoiceUpdates = {
          ...invoiceUpdates,
          subtotal: totals.subtotal,
          tax_amount: totals.tax_amount,
          total_amount: totals.total_amount,
          balance_due: totals.total_amount - (existing.amount_paid || 0)
        };

        // Delete old lines and insert new ones
        await supabase.from('invoice_lines').delete().eq('invoice_id', invoiceId);

        const lines = updates.lines.map((line, index) => ({
          invoice_id: invoiceId,
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent || 0,
          tax_rate: line.tax_rate || 0,
          amount: line.amount,
          account_id: line.account_id,
          line_order: index
        }));

        await supabase.from('invoice_lines').insert(lines);
      }

      // Update invoice
      const { data, error } = await supabase
        .from('invoices')
        .update(withTimestamp(invoiceUpdates))
        .eq('id', invoiceId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invoice (mark as sent)
   */
  static async sendInvoice(invoiceId: string): Promise<ServiceResponse> {
    try {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*)')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;

      const isQuotation = invoice.document_type === 'quotation';

      // Create journal entry when invoice is sent (skip for quotations)
      let journalEntryId = invoice.journal_entry_id;
      if (!journalEntryId && !isQuotation) {
        const journalResult = await JournalEntryService.createJournalEntryFromInvoice(
          invoice.user_id,
          invoice.id,
          {
            customer_id: invoice.customer_id,
            total_amount: invoice.total_amount,
            tax_amount: invoice.tax_amount,
            subtotal: invoice.subtotal,
            discount_amount: invoice.discount_amount || 0,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date
          }
        );

        if (journalResult.success && journalResult.data) {
          journalEntryId = journalResult.data.id;
          
          // Update invoice with journal entry reference
          await supabase
            .from('invoices')
            .update({ journal_entry_id: journalEntryId })
            .eq('id', invoice.id);
        } else {
          console.error('Failed to create journal entry:', journalResult.error);
          return { success: false, error: `Failed to create journal entry: ${journalResult.error}` };
        }
      }

      // Record COGS for product items (skip for quotations)
      if (!isQuotation && invoice.lines && invoice.lines.length > 0) {
        for (const line of invoice.lines) {
          if (line.product_id) {
            // Get product details to check if it's a tracked inventory item
            const { data: product } = await supabase
              .from('products')
              .select('type, track_inventory, cost')
              .eq('id', line.product_id)
              .single();

            if (product && product.type === 'product' && product.track_inventory) {
              // Record COGS and reduce inventory
              const cost = product.cost || 0;
              const totalCost = line.quantity * cost;

              await InventoryService.recordCostOfGoodsSold(
                invoice.user_id,
                {
                  product_id: line.product_id,
                  quantity: line.quantity,
                  unit_cost: cost,
                  total_cost: totalCost,
                  sale_date: invoice.invoice_date,
                  invoice_id: invoice.id,
                  reference: `${invoice.invoice_number}-${line.product_id}`
                }
              );
            }
          }
        }
      }

      // Update status and ensure balance_due is correct
      const updateData: any = {
        status: 'sent',
        sent_at: new Date().toISOString()
      };

      // For invoices (not quotations), ensure balance_due is set correctly
      if (!isQuotation) {
        // balance_due should be total_amount - amount_paid
        updateData.balance_due = invoice.total_amount - (invoice.amount_paid || 0);
      }

      const { error } = await supabase
        .from('invoices')
        .update(withTimestamp(updateData))
        .eq('id', invoiceId);

      if (error) throw error;

      // Update customer balance (skip for quotations)
      if (!isQuotation) {
        await CustomerService.calculateCustomerBalance(invoice.customer_id);
        
        // Record transaction for invoice sent
        await TransactionIntegrationService.recordInvoiceSentTransaction(invoiceId);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Void an invoice
   */
  static async voidInvoice(invoiceId: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase
        .from('invoices')
        .update(withTimestamp({
          status: 'void',
          voided_at: new Date().toISOString()
        }))
        .eq('id', invoiceId);

      if (error) throw error;

      // Void related journal entry
      const { data: invoice } = await supabase
        .from('invoices')
        .select('journal_entry_id, customer_id')
        .eq('id', invoiceId)
        .single();

      if (invoice?.journal_entry_id) {
        await JournalEntryService.voidJournalEntry(invoice.journal_entry_id);
      }

      // Recalculate customer balance
      if (invoice?.customer_id) {
        await CustomerService.calculateCustomerBalance(invoice.customer_id);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error voiding invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get invoices with filters
   */
  static async getInvoices(
    userId: string,
    filters?: {
      customerId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      overdue?: boolean;
    }
  ): Promise<ServiceResponse<InvoiceWithLines[]>> {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(name, email, company_name),
          lines:invoice_lines(*, product:products(name))
        `)
        .eq('user_id', userId);

      if (filters?.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('invoice_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('invoice_date', filters.endDate);
      }
      if (filters?.overdue) {
        query = query.lt('due_date', new Date().toISOString().split('T')[0])
          .neq('status', 'paid')
          .neq('status', 'void');
      }

      query = query.order('invoice_date', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get invoice by ID with all details
   */
  static async getInvoiceById(invoiceId: string): Promise<ServiceResponse<InvoiceWithLines>> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          lines:invoice_lines(*, product:products(*), account:accounts(name))
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;
      if (!data) {
        return { success: false, error: 'Invoice not found' };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record a payment against an invoice
   */
  static async recordPayment(
    invoiceId: string,
    amount: number,
    paymentDate: string,
    paymentMethod: string,
    bankAccountId: string,
    notes?: string
  ): Promise<ServiceResponse> {
    try {
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw fetchError;
      if (!invoice) {
        return { success: false, error: 'Invoice not found' };
      }

      if (amount > invoice.balance_due) {
        return {
          success: false,
          error: `Payment amount ($${amount}) exceeds balance due ($${invoice.balance_due})`
        };
      }

      const newAmountPaid = (invoice.amount_paid || 0) + amount;
      const newBalanceDue = invoice.total_amount - newAmountPaid;
      const newStatus = newBalanceDue === 0 ? 'paid' :
                       newAmountPaid > 0 ? 'partial' : invoice.status;

      // Update invoice
      const { error: updateError } = await supabase
        .from('invoices')
        .update(withTimestamp({
          amount_paid: newAmountPaid,
          balance_due: newBalanceDue,
          status: newStatus,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null
        }))
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Recalculate customer balance
      await CustomerService.calculateCustomerBalance(invoice.customer_id);

      return { success: true };
    } catch (error: any) {
      console.error('Error recording payment:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert a quotation to an invoice
   */
  static async convertQuotationToInvoice(
    quotationId: string
  ): Promise<ServiceResponse<Invoice>> {
    try {
      // Fetch the quotation with all details
      const { data: quotation, error: fetchError } = await supabase
        .from('invoices')
        .select('*, lines:invoice_lines(*)')
        .eq('id', quotationId)
        .single();

      if (fetchError) throw fetchError;
      if (!quotation) {
        return { success: false, error: 'Quotation not found' };
      }

      if (quotation.document_type !== 'quotation') {
        return { success: false, error: 'Document is not a quotation' };
      }

      if (quotation.converted_to_invoice_id) {
        return { success: false, error: 'Quotation has already been converted to an invoice' };
      }

      // Create new invoice from quotation
      const invoiceNumber = await this.getNextInvoiceNumber(quotation.user_id);
      
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          user_id: quotation.user_id,
          customer_id: quotation.customer_id,
          document_type: 'invoice',
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().split('T')[0], // Today's date
          due_date: quotation.due_date,
          status: 'draft',
          subtotal: quotation.subtotal,
          tax_amount: quotation.tax_amount,
          discount_amount: quotation.discount_amount,
          total_amount: quotation.total_amount,
          amount_paid: 0,
          balance_due: quotation.total_amount,
          notes: quotation.notes,
          terms: quotation.terms,
          footer: quotation.footer,
          purchase_order: quotation.purchase_order,
          converted_from_quotation_id: quotationId
        }])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Copy line items
      const lines = quotation.lines.map((line: any) => ({
        invoice_id: newInvoice.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percent: line.discount_percent,
        tax_rate: line.tax_rate,
        amount: line.amount,
        account_id: line.account_id,
        line_order: line.line_order
      }));

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(lines);

      if (linesError) {
        // Rollback
        await supabase.from('invoices').delete().eq('id', newInvoice.id);
        throw linesError;
      }

      // Update quotation to mark it as converted
      await supabase
        .from('invoices')
        .update({
          converted_to_invoice_id: newInvoice.id,
          status: 'accepted'
        })
        .eq('id', quotationId);

      return { success: true, data: newInvoice };
    } catch (error: any) {
      console.error('Error converting quotation to invoice:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get aging report (invoices by age)
   */
  static async getAgingReport(userId: string): Promise<ServiceResponse<any>> {
    try {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('*, customer:customers(name, email)')
        .eq('user_id', userId)
        .neq('status', 'paid')
        .neq('status', 'void');

      if (error) throw error;

      const today = new Date();
      const aging = {
        current: 0,      // 0-30 days
        days_31_60: 0,   // 31-60 days
        days_61_90: 0,   // 61-90 days
        over_90: 0,      // Over 90 days
        total: 0
      };

      const invoicesByAge: any[] = [];

      invoices?.forEach(invoice => {
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const balance = invoice.balance_due;

        if (daysOverdue <= 0) {
          aging.current += balance;
        } else if (daysOverdue <= 30) {
          aging.current += balance;
        } else if (daysOverdue <= 60) {
          aging.days_31_60 += balance;
        } else if (daysOverdue <= 90) {
          aging.days_61_90 += balance;
        } else {
          aging.over_90 += balance;
        }

        aging.total += balance;

        invoicesByAge.push({
          ...invoice,
          days_overdue: Math.max(0, daysOverdue),
          age_bucket: daysOverdue <= 30 ? 'current' :
                     daysOverdue <= 60 ? '31-60' :
                     daysOverdue <= 90 ? '61-90' : '90+'
        });
      });

      return {
        success: true,
        data: {
          summary: aging,
          invoices: invoicesByAge
        }
      };
    } catch (error: any) {
      console.error('Error generating aging report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate balance_due for all invoices of a user
   * Useful for fixing data inconsistencies
   */
  static async recalculateAllBalances(userId: string): Promise<ServiceResponse<number>> {
    try {
      // Get all invoices for this user
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, total_amount, amount_paid, document_type, status')
        .eq('user_id', userId)
        .neq('status', 'void')
        .neq('status', 'cancelled');

      if (error) throw error;

      if (!invoices || invoices.length === 0) {
        return { success: true, data: 0 };
      }

      let updatedCount = 0;
      for (const invoice of invoices) {
        // Quotations should have balance_due = 0
        const correctBalance = invoice.document_type === 'quotation' 
          ? 0 
          : invoice.total_amount - (invoice.amount_paid || 0);

        // Update if balance is incorrect
        const { error: updateError } = await supabase
          .from('invoices')
          .update({ balance_due: correctBalance })
          .eq('id', invoice.id);

        if (!updateError) {
          updatedCount++;
        }
      }

      return { 
        success: true, 
        data: updatedCount,
        message: `Updated ${updatedCount} invoices`
      };
    } catch (error: any) {
      console.error('Error recalculating invoice balances:', error);
      return { success: false, error: error.message };
    }
  }
}

