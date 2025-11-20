/**
 * Inventory Service
 * Handles inventory tracking with proper double-entry bookkeeping
 * All business logic in application code
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { JournalEntryService } from './journalEntryService';
import { StockMovementService } from './stockMovementService';

export class InventoryService {
  /**
   * Record inventory purchase (when buying stock)
   * DEBIT: Inventory (Asset)
   * CREDIT: Cash/Accounts Payable (Asset/Liability)
   */
  static async recordInventoryPurchase(
    userId: string,
    data: {
      product_id: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      purchase_date: string;
      vendor_id?: string;
      reference?: string;
      notes?: string;
    }
  ): Promise<ServiceResponse> {
    try {
      // Get required accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', userId)
        .in('code', ['1300', '1010']); // Inventory, Bank Account

      const inventoryAccount = accounts?.find(a => a.code === '1300');
      const bankAccount = accounts?.find(a => a.code === '1010');

      if (!inventoryAccount || !bankAccount) {
        return {
          success: false,
          error: 'Required accounts not found. Please ensure Inventory (1300) and Bank Account (1010) exist.'
        };
      }

      // Update product quantity
      const { data: product } = await supabase
        .from('products')
        .select('quantity_on_hand')
        .eq('id', data.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({
            quantity_on_hand: (product.quantity_on_hand || 0) + data.quantity,
            cost: data.unit_cost // Update cost
          })
          .eq('id', data.product_id);
      }

      // Create journal entry for inventory purchase
      const journalResult = await JournalEntryService.createJournalEntry({
        user_id: userId,
        entry_date: data.purchase_date,
        reference: data.reference || `INV-PURCHASE-${data.product_id}`,
        description: `Inventory purchase${data.notes ? ': ' + data.notes : ''}`,
        status: 'posted',
        notes: `Product ID: ${data.product_id}\nQuantity: ${data.quantity}\nUnit Cost: $${data.unit_cost}`,
        lines: [
          {
            journal_entry_id: '',
            account_id: inventoryAccount.id,
            debit: data.total_cost,
            credit: 0,
            description: 'Inventory purchased'
          },
          {
            journal_entry_id: '',
            account_id: bankAccount.id,
            debit: 0,
            credit: data.total_cost,
            description: 'Cash paid for inventory'
          }
        ]
      });

      if (!journalResult.success) {
        return journalResult;
      }

      return {
        success: true,
        message: `Inventory purchase recorded. ${data.quantity} units added.`
      };
    } catch (error: any) {
      console.error('Error recording inventory purchase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record cost of goods sold (when selling inventory)
   * DEBIT: Cost of Goods Sold (Expense)
   * CREDIT: Inventory (Asset)
   */
  static async recordCostOfGoodsSold(
    userId: string,
    data: {
      product_id: string;
      quantity: number;
      unit_cost: number;
      total_cost: number;
      sale_date: string;
      invoice_id?: string;
      reference?: string;
    }
  ): Promise<ServiceResponse> {
    try {
      // Get required accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', userId)
        .in('code', ['1300', '5000']); // Inventory, COGS

      const inventoryAccount = accounts?.find(a => a.code === '1300');
      const cogsAccount = accounts?.find(a => a.code === '5000');

      if (!inventoryAccount || !cogsAccount) {
        return {
          success: false,
          error: 'Required accounts not found. Please ensure Inventory (1300) and COGS (5000) exist.'
        };
      }

      // Check if sufficient inventory (don't update here - StockMovementService will update)
      const { data: product } = await supabase
        .from('products')
        .select('quantity_on_hand')
        .eq('id', data.product_id)
        .single();

      if (product) {
        const newQuantity = (product.quantity_on_hand || 0) - data.quantity;
        if (newQuantity < 0) {
          return {
            success: false,
            error: `Insufficient inventory. Available: ${product.quantity_on_hand}, Requested: ${data.quantity}`
          };
        }
        // Note: Quantity update is handled by StockMovementService below
      }

      // Get product and customer details for stock movement
      const { data: productData } = await supabase
        .from('products')
        .select('name')
        .eq('id', data.product_id)
        .single();

      let customerName = 'Customer';
      if (data.invoice_id) {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select(`
            invoice_number,
            customer:customers(name)
          `)
          .eq('id', data.invoice_id)
          .single();

        if (invoiceData && invoiceData.customer) {
          customerName = invoiceData.customer.name;
        }
      }

      // Record stock movement (sale)
      const movementResult = await StockMovementService.recordStockMovement({
        user_id: userId,
        product_id: data.product_id,
        movement_type: 'sale',
        quantity: -data.quantity, // Negative for sale
        unit_cost: data.unit_cost,
        reference_type: 'invoice',
        reference_id: data.invoice_id,
        reference_number: data.reference,
        description: `Sold to ${customerName}`,
        movement_date: data.sale_date,
        create_journal_entry: false // Journal entry created below
      });

      if (!movementResult.success) {
        console.warn('Stock movement recording failed:', movementResult.error);
      }

      // Create journal entry for COGS
      const journalResult = await JournalEntryService.createJournalEntry({
        user_id: userId,
        entry_date: data.sale_date,
        reference: data.reference || `COGS-${data.product_id}`,
        description: `Cost of goods sold - ${productData?.name || 'Product'}`,
        status: 'posted',
        source_type: data.invoice_id ? 'invoice' : undefined,
        source_id: data.invoice_id,
        notes: `Product ID: ${data.product_id}\nQuantity: ${data.quantity}\nUnit Cost: $${data.unit_cost}`,
        lines: [
          {
            journal_entry_id: '',
            account_id: cogsAccount.id,
            debit: data.total_cost,
            credit: 0,
            description: 'Cost of goods sold',
            entity_type: 'product',
            entity_id: data.product_id
          },
          {
            journal_entry_id: '',
            account_id: inventoryAccount.id,
            debit: 0,
            credit: data.total_cost,
            description: 'Inventory reduced',
            entity_type: 'product',
            entity_id: data.product_id
          }
        ]
      });

      if (!journalResult.success) {
        return journalResult;
      }

      return {
        success: true,
        message: `COGS recorded. ${data.quantity} units removed from inventory.`
      };
    } catch (error: any) {
      console.error('Error recording COGS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get inventory valuation
   * Sum of all inventory on hand at cost
   */
  static async getInventoryValuation(userId: string): Promise<ServiceResponse<number>> {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('quantity_on_hand, cost')
        .eq('user_id', userId)
        .eq('type', 'product')
        .eq('track_inventory', true)
        .eq('is_active', true);

      const valuation = products?.reduce((sum, p) => {
        return sum + ((p.quantity_on_hand || 0) * (p.cost || 0));
      }, 0) || 0;

      return {
        success: true,
        data: valuation
      };
    } catch (error: any) {
      console.error('Error calculating inventory valuation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get low stock products
   */
  static async getLowStockProducts(userId: string): Promise<ServiceResponse<any[]>> {
    try {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'product')
        .eq('track_inventory', true)
        .eq('is_active', true);

      const lowStock = products?.filter(p => 
        (p.quantity_on_hand || 0) <= (p.reorder_point || 0)
      ) || [];

      return {
        success: true,
        data: lowStock
      };
    } catch (error: any) {
      console.error('Error getting low stock products:', error);
      return { success: false, error: error.message };
    }
  }
}

