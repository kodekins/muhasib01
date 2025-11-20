/**
 * Sales Order Service
 * Handles sales order management and conversion to invoices
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { InvoiceService } from './invoiceService';

export interface SalesOrder {
  id?: string;
  user_id: string;
  customer_id: string;
  order_number?: string;
  order_date: string;
  expected_delivery_date?: string;
  status?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  converted_invoice_id?: string;
  converted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalesOrderLine {
  id?: string;
  sales_order_id?: string;
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

export interface SalesOrderWithLines extends SalesOrder {
  lines: SalesOrderLine[];
}

export class SalesOrderService {
  /**
   * Generate next sales order number
   */
  static async getNextOrderNumber(userId: string): Promise<string> {
    try {
      const { data: latestOrder, error } = await supabase
        .from('sales_orders')
        .select('order_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching latest sales order:', error);
      }

      if (latestOrder && latestOrder.order_number) {
        const match = latestOrder.order_number.match(/SO-(\d+)/);
        if (match) {
          const nextNumber = parseInt(match[1], 10) + 1;
          return `SO-${String(nextNumber).padStart(5, '0')}`;
        }
      }

      return 'SO-00001';
    } catch (error) {
      console.error('Error generating sales order number:', error);
      return `SO-${Date.now()}`;
    }
  }

  /**
   * Create a sales order with line items
   */
  static async createSalesOrder(
    order: SalesOrderWithLines
  ): Promise<ServiceResponse<SalesOrder>> {
    try {
      // Generate order number if not provided
      if (!order.order_number) {
        order.order_number = await this.getNextOrderNumber(order.user_id);
      }

      // Create sales order with retry logic for duplicates
      let newOrder = null;
      let orderError = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !newOrder) {
        const result = await supabase
          .from('sales_orders')
          .insert([{
            user_id: order.user_id,
            customer_id: order.customer_id,
            order_number: order.order_number,
            order_date: order.order_date,
            expected_delivery_date: order.expected_delivery_date,
            status: order.status || 'draft',
            subtotal: order.subtotal,
            tax_amount: order.tax_amount || 0,
            discount_amount: order.discount_amount || 0,
            total_amount: order.total_amount,
            notes: order.notes,
            terms: order.terms
          }])
          .select()
          .single();

        newOrder = result.data;
        orderError = result.error;

        if (orderError && orderError.code === '23505' && orderError.message.includes('order_number')) {
          retries++;
          order.order_number = `SO-${Date.now()}-${retries}`;
          console.log(`Duplicate order number detected, retrying with: ${order.order_number}`);
        } else {
          break;
        }
      }

      if (orderError) throw orderError;

      // Create line items
      const lines = order.lines.map((line, index) => ({
        sales_order_id: newOrder.id,
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
        .from('sales_order_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return {
        success: true,
        data: newOrder,
        message: 'Sales order created successfully'
      };
    } catch (error: any) {
      console.error('Error creating sales order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get sales orders with filters
   */
  static async getSalesOrders(
    userId: string,
    filters?: { status?: string; customer_id?: string }
  ): Promise<ServiceResponse<SalesOrder[]>> {
    try {
      let query = supabase
        .from('sales_orders')
        .select('*, customer:customers(name, company_name)')
        .eq('user_id', userId)
        .order('order_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching sales orders:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert Sales Order to Invoice (automatically sent)
   */
  static async convertToInvoice(
    salesOrderId: string
  ): Promise<ServiceResponse<any>> {
    try {
      // Get sales order with lines
      const { data: salesOrder, error: orderError } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', salesOrderId)
        .single();

      if (orderError || !salesOrder) {
        return { success: false, error: 'Sales order not found' };
      }

      if (salesOrder.status === 'converted') {
        return { success: false, error: 'Sales order already converted' };
      }

      const { data: orderLines, error: linesError } = await supabase
        .from('sales_order_lines')
        .select('*')
        .eq('sales_order_id', salesOrderId)
        .order('line_order');

      if (linesError) throw linesError;

      // Create invoice using InvoiceService
      const invoiceResult = await InvoiceService.createInvoice({
        user_id: salesOrder.user_id,
        customer_id: salesOrder.customer_id,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: salesOrder.subtotal,
        tax_amount: salesOrder.tax_amount,
        discount_amount: salesOrder.discount_amount || 0,
        total_amount: salesOrder.total_amount,
        notes: `Converted from Sales Order ${salesOrder.order_number}\n${salesOrder.notes || ''}`,
        terms: salesOrder.terms,
        lines: orderLines?.map(line => ({
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_percent: line.discount_percent || 0,
          tax_rate: line.tax_rate || 0,
          amount: line.amount,
          account_id: line.account_id
        })) || []
      });

      if (!invoiceResult.success || !invoiceResult.data) {
        return { success: false, error: 'Failed to create invoice' };
      }

      const invoice = invoiceResult.data;

      // Automatically send the invoice
      const sendResult = await InvoiceService.sendInvoice(invoice.id!);

      if (!sendResult.success) {
        console.warn('Invoice created but failed to send:', sendResult.error);
      }

      // Update sales order status
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({
          status: 'converted',
          converted_invoice_id: invoice.id,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', salesOrderId);

      if (updateError) throw updateError;

      return {
        success: true,
        data: invoice,
        message: `Sales order converted to invoice ${invoice.invoice_number} and automatically sent!`
      };
    } catch (error: any) {
      console.error('Error converting sales order to invoice:', error);
      return { success: false, error: error.message };
    }
  }
}

