import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { JournalEntryService } from './journalEntryService';

interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'return';
  quantity: number;
  unit_cost: number;
  total_value: number;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  description?: string;
  movement_date: string;
  created_at: string;
}

interface CreateStockMovementData {
  product_id: string;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'return';
  quantity: number; // Positive for increases, negative for decreases
  unit_cost: number;
  reference_type?: string; // 'invoice', 'bill', 'adjustment', etc.
  reference_id?: string;
  reference_number?: string;
  description?: string;
  movement_date?: string;
  user_id: string;
  create_journal_entry?: boolean;
}

export class StockMovementService {
  /**
   * Record a stock movement with proper double-entry bookkeeping
   */
  static async recordStockMovement(
    data: CreateStockMovementData
  ): Promise<ServiceResponse<StockMovement>> {
    try {
      const total_value = Math.abs(data.quantity) * data.unit_cost;
      const movement_date = data.movement_date || new Date().toISOString();

      // Insert stock movement record
      const { data: movement, error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
          product_id: data.product_id,
          movement_type: data.movement_type,
          quantity: data.quantity,
          unit_cost: data.unit_cost,
          total_value: total_value,
          reference_type: data.reference_type,
          reference_id: data.reference_id,
          reference_number: data.reference_number,
          description: data.description,
          movement_date: movement_date,
          user_id: data.user_id
        }])
        .select()
        .single();

      if (movementError) throw movementError;

      // Update product quantity
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('quantity_on_hand, name')
        .eq('id', data.product_id)
        .single();

      if (productError) throw productError;

      const newQuantity = (product.quantity_on_hand || 0) + data.quantity;

      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity_on_hand: newQuantity })
        .eq('id', data.product_id);

      if (updateError) throw updateError;

      // Create journal entry if requested (for purchases and adjustments)
      if (data.create_journal_entry !== false) {
        await this.createJournalEntryForMovement({
          movement,
          product_name: product.name,
          user_id: data.user_id,
          movement_type: data.movement_type,
          quantity: data.quantity,
          unit_cost: data.unit_cost,
          total_value: total_value,
          description: data.description,
          reference_number: data.reference_number
        });
      }

      return {
        success: true,
        data: movement
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to record stock movement'
      };
    }
  }

  /**
   * Create journal entry for stock movement
   * Purchase: Debit Inventory, Credit Accounts Payable/Cash
   * Sale: Handled by invoice service (COGS entry)
   * Adjustment: Debit/Credit Inventory, Credit/Debit Inventory Adjustment account
   */
  private static async createJournalEntryForMovement(params: {
    movement: any;
    product_name: string;
    user_id: string;
    movement_type: string;
    quantity: number;
    unit_cost: number;
    total_value: number;
    description?: string;
    reference_number?: string;
  }) {
    try {
      // Get required accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, code, name')
        .eq('user_id', params.user_id)
        .in('code', ['1300', '5000']); // Inventory Asset, COGS

      const inventoryAccount = accounts?.find(a => a.code === '1300');
      const cogsAccount = accounts?.find(a => a.code === '5000');

      if (!inventoryAccount) {
        console.warn('Inventory account (1300) not found for journal entry');
        return;
      }

      let journalDescription = '';
      let lines: any[] = [];

      switch (params.movement_type) {
        case 'purchase':
          // Debit: Inventory (increase asset)
          // Credit: Accounts Payable (increase liability)
          const { data: apAccount } = await supabase
            .from('accounts')
            .select('id, code')
            .eq('user_id', params.user_id)
            .eq('code', '2000') // Accounts Payable
            .single();

          if (!apAccount) {
            console.warn('Accounts Payable account (2000) not found for purchase journal entry');
            return;
          }

          journalDescription = `Inventory purchase - ${params.product_name}`;
          lines = [
            {
              journal_entry_id: '',
              account_id: inventoryAccount.id,
              debit: params.total_value,
              credit: 0,
              description: `Purchase ${Math.abs(params.quantity)} units @ $${params.unit_cost}`,
              entity_type: 'product',
              entity_id: params.movement.product_id
            },
            {
              journal_entry_id: '',
              account_id: apAccount.id,
              debit: 0,
              credit: params.total_value,
              description: 'Accounts Payable',
              entity_type: 'product',
              entity_id: params.movement.product_id
            }
          ];
          break;

        case 'adjustment':
          // Positive adjustment: Debit Inventory, Credit Inventory Adjustment (or COGS)
          // Negative adjustment: Debit COGS (or loss), Credit Inventory
          if (params.quantity > 0) {
            // Increase inventory
            journalDescription = `Inventory adjustment (increase) - ${params.product_name}`;
            lines = [
              {
                journal_entry_id: '',
                account_id: inventoryAccount.id,
                debit: params.total_value,
                credit: 0,
                description: `Inventory increase: +${params.quantity} units`,
                entity_type: 'product',
                entity_id: params.movement.product_id
              },
              {
                journal_entry_id: '',
                account_id: cogsAccount?.id || inventoryAccount.id,
                debit: 0,
                credit: params.total_value,
                description: 'Inventory adjustment',
                entity_type: 'product',
                entity_id: params.movement.product_id
              }
            ];
          } else {
            // Decrease inventory
            journalDescription = `Inventory adjustment (decrease) - ${params.product_name}`;
            lines = [
              {
                journal_entry_id: '',
                account_id: cogsAccount?.id || inventoryAccount.id,
                debit: params.total_value,
                credit: 0,
                description: 'Inventory adjustment',
                entity_type: 'product',
                entity_id: params.movement.product_id
              },
              {
                journal_entry_id: '',
                account_id: inventoryAccount.id,
                debit: 0,
                credit: params.total_value,
                description: `Inventory decrease: ${params.quantity} units`,
                entity_type: 'product',
                entity_id: params.movement.product_id
              }
            ];
          }
          break;

        case 'return':
          // Customer return: Debit Inventory, Credit COGS
          journalDescription = `Inventory return - ${params.product_name}`;
          lines = [
            {
              journal_entry_id: '',
              account_id: inventoryAccount.id,
              debit: params.total_value,
              credit: 0,
              description: `Return ${Math.abs(params.quantity)} units`,
              entity_type: 'product',
              entity_id: params.movement.product_id
            },
            {
              journal_entry_id: '',
              account_id: cogsAccount?.id || inventoryAccount.id,
              debit: 0,
              credit: params.total_value,
              description: 'COGS reversal',
              entity_type: 'product',
              entity_id: params.movement.product_id
            }
          ];
          break;

        default:
          // Sale is handled by invoice service
          return;
      }

      if (lines.length > 0) {
        const journalResult = await JournalEntryService.createJournalEntry({
          user_id: params.user_id,
          entry_date: params.movement.movement_date,
          description: journalDescription,
          status: 'posted',
          source_type: 'stock_movement',
          source_id: params.movement.id,
          reference: params.reference_number || params.movement.id,
          notes: params.description,
          lines: lines
        });

        if (!journalResult.success) {
          console.warn('Journal entry for stock movement failed:', journalResult.error);
        }
      }
    } catch (error: any) {
      console.error('Error creating journal entry for stock movement:', error);
    }
  }

  /**
   * Get stock movements for a specific product
   */
  static async getProductMovements(
    productId: string
  ): Promise<ServiceResponse<StockMovement[]>> {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', productId)
        .order('movement_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch stock movements'
      };
    }
  }

  /**
   * Get all stock movements with product details
   */
  static async getAllMovements(
    userId: string,
    filters?: {
      product_id?: string;
      movement_type?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<ServiceResponse<any[]>> {
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          product:products(id, name, sku, unit_of_measure)
        `)
        .eq('user_id', userId);

      if (filters?.product_id) {
        query = query.eq('product_id', filters.product_id);
      }

      if (filters?.movement_type) {
        query = query.eq('movement_type', filters.movement_type);
      }

      if (filters?.start_date) {
        query = query.gte('movement_date', filters.start_date);
      }

      if (filters?.end_date) {
        query = query.lte('movement_date', filters.end_date);
      }

      const { data, error } = await query.order('movement_date', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch stock movements'
      };
    }
  }
}

