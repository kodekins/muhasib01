/**
 * Purchase Order Service
 * Handles purchase order management and conversion to bills
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { BillService } from './billService';

export interface PurchaseOrder {
  id?: string;
  user_id: string;
  vendor_id: string;
  order_number?: string;
  order_date: string;
  expected_delivery_date?: string;
  status?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  terms?: string;
  shipping_address?: string;
  converted_bill_id?: string;
  converted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderLine {
  id?: string;
  purchase_order_id?: string;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  account_id?: string;
  line_order?: number;
}

export interface PurchaseOrderWithLines extends PurchaseOrder {
  lines: PurchaseOrderLine[];
}

export class PurchaseOrderService {
  /**
   * Generate next purchase order number
   */
  static async getNextOrderNumber(userId: string): Promise<string> {
    try {
      const { data: latestOrder, error } = await supabase
        .from('purchase_orders')
        .select('order_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching latest purchase order:', error);
      }

      if (latestOrder && latestOrder.order_number) {
        const match = latestOrder.order_number.match(/PO-(\d+)/);
        if (match) {
          const nextNumber = parseInt(match[1], 10) + 1;
          return `PO-${String(nextNumber).padStart(5, '0')}`;
        }
      }

      return 'PO-00001';
    } catch (error) {
      console.error('Error generating purchase order number:', error);
      return `PO-${Date.now()}`;
    }
  }

  /**
   * Create a purchase order with line items
   */
  static async createPurchaseOrder(
    order: PurchaseOrderWithLines
  ): Promise<ServiceResponse<PurchaseOrder>> {
    try {
      // Generate order number if not provided
      if (!order.order_number) {
        order.order_number = await this.getNextOrderNumber(order.user_id);
      }

      // Create purchase order with retry logic for duplicates
      let newOrder = null;
      let orderError = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries && !newOrder) {
        const result = await supabase
          .from('purchase_orders')
          .insert([{
            user_id: order.user_id,
            vendor_id: order.vendor_id,
            order_number: order.order_number,
            order_date: order.order_date,
            expected_delivery_date: order.expected_delivery_date,
            status: order.status || 'draft',
            subtotal: order.subtotal,
            tax_amount: order.tax_amount || 0,
            total_amount: order.total_amount,
            notes: order.notes,
            terms: order.terms,
            shipping_address: order.shipping_address
          }])
          .select()
          .single();

        newOrder = result.data;
        orderError = result.error;

        if (orderError && orderError.code === '23505' && orderError.message.includes('order_number')) {
          retries++;
          order.order_number = `PO-${Date.now()}-${retries}`;
          console.log(`Duplicate order number detected, retrying with: ${order.order_number}`);
        } else {
          break;
        }
      }

      if (orderError) throw orderError;

      // Create line items
      const lines = order.lines.map((line, index) => ({
        purchase_order_id: newOrder.id,
        product_id: line.product_id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        amount: line.amount,
        account_id: line.account_id,
        line_order: index
      }));

      const { error: linesError } = await supabase
        .from('purchase_order_lines')
        .insert(lines);

      if (linesError) throw linesError;

      return {
        success: true,
        data: newOrder,
        message: 'Purchase order created successfully'
      };
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get purchase orders with filters
   */
  static async getPurchaseOrders(
    userId: string,
    filters?: { status?: string; vendor_id?: string }
  ): Promise<ServiceResponse<PurchaseOrder[]>> {
    try {
      let query = supabase
        .from('purchase_orders')
        .select('*, vendor:vendors(name, company_name)')
        .eq('user_id', userId)
        .order('order_date', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.vendor_id) {
        query = query.eq('vendor_id', filters.vendor_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching purchase orders:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert Purchase Order to Bill (automatically approved)
   */
  static async convertToBill(
    purchaseOrderId: string
  ): Promise<ServiceResponse<any>> {
    try {
      // Get purchase order with lines
      const { data: purchaseOrder, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', purchaseOrderId)
        .single();

      if (orderError || !purchaseOrder) {
        return { success: false, error: 'Purchase order not found' };
      }

      if (purchaseOrder.status === 'converted') {
        return { success: false, error: 'Purchase order already converted' };
      }

      const { data: orderLines, error: linesError } = await supabase
        .from('purchase_order_lines')
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .order('line_order');

      if (linesError) throw linesError;

      // Create bill using BillService
      const billResult = await BillService.createBill({
        user_id: purchaseOrder.user_id,
        vendor_id: purchaseOrder.vendor_id,
        bill_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: purchaseOrder.subtotal,
        tax_amount: purchaseOrder.tax_amount,
        total_amount: purchaseOrder.total_amount,
        notes: `Converted from Purchase Order ${purchaseOrder.order_number}\n${purchaseOrder.notes || ''}`,
        terms: purchaseOrder.terms,
        lines: orderLines?.map(line => ({
          product_id: line.product_id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          amount: line.amount,
          account_id: line.account_id
        })) || []
      });

      if (!billResult.success || !billResult.data) {
        return { success: false, error: 'Failed to create bill' };
      }

      const bill = billResult.data;

      // Automatically approve the bill
      const approveResult = await BillService.approveBill(bill.id!);

      if (!approveResult.success) {
        console.warn('Bill created but failed to approve:', approveResult.error);
      }

      // Update purchase order status
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          status: 'converted',
          converted_bill_id: bill.id,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', purchaseOrderId);

      if (updateError) throw updateError;

      return {
        success: true,
        data: bill,
        message: `Purchase order converted to bill ${bill.bill_number} and automatically approved!`
      };
    } catch (error: any) {
      console.error('Error converting purchase order to bill:', error);
      return { success: false, error: error.message };
    }
  }
}

