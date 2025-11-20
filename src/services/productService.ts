/**
 * Product Service
 * Handles products/services catalog management
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import { withTimestamp } from './utils/timestamp';

export interface Product {
  id?: string;
  user_id: string;
  type: 'service' | 'product' | 'inventory';
  name: string;
  sku?: string;
  description?: string;
  unit_price: number;
  cost?: number;
  income_account_id?: string;
  expense_account_id?: string;
  inventory_account_id?: string;
  track_inventory?: boolean;
  quantity_on_hand?: number;
  reorder_point?: number;
  taxable?: boolean;
  tax_rate?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class ProductService {
  /**
   * Validate product data
   */
  static validateProduct(product: Product): ServiceResponse {
    const errors: string[] = [];

    if (!product.name) errors.push('Name is required');
    if (product.unit_price < 0) errors.push('Price cannot be negative');
    if (product.cost && product.cost < 0) errors.push('Cost cannot be negative');

    if (product.track_inventory && !product.inventory_account_id) {
      errors.push('Inventory account is required for inventory tracking');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  }

  /**
   * Create a product/service
   */
  static async createProduct(product: Product): Promise<ServiceResponse<Product>> {
    try {
      // Validate product
      const validation = this.validateProduct(product);
      if (!validation.success) {
        return validation;
      }

      const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error creating product:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update a product/service
   */
  static async updateProduct(
    productId: string,
    updates: Partial<Product>
  ): Promise<ServiceResponse<Product>> {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(withTimestamp(updates))
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating product:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete a product/service
   */
  static async deleteProduct(productId: string): Promise<ServiceResponse> {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting product:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get products/services
   */
  static async getProducts(
    userId: string,
    filters?: {
      type?: string;
      isActive?: boolean;
      search?: string;
    }
  ): Promise<ServiceResponse<Product[]>> {
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          income_account:accounts!products_income_account_id_fkey(name),
          expense_account:accounts!products_expense_account_id_fkey(name),
          inventory_account:accounts!products_inventory_account_id_fkey(name)
        `)
        .eq('user_id', userId);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching products:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get product by ID
   */
  static async getProductById(productId: string): Promise<ServiceResponse<Product>> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) throw error;
      if (!data) {
        return { success: false, error: 'Product not found' };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('Error fetching product:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update inventory quantity
   */
  static async updateInventory(
    productId: string,
    quantityChange: number,
    reason: string
  ): Promise<ServiceResponse> {
    try {
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('quantity_on_hand, track_inventory')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;
      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      if (!product.track_inventory) {
        return { success: false, error: 'This product does not track inventory' };
      }

      const newQuantity = (product.quantity_on_hand || 0) + quantityChange;

      if (newQuantity < 0) {
        return {
          success: false,
          error: `Insufficient inventory. Current: ${product.quantity_on_hand}, Requested change: ${quantityChange}`
        };
      }

      const { error } = await supabase
        .from('products')
        .update(withTimestamp({ quantity_on_hand: newQuantity }))
        .eq('id', productId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Error updating inventory:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get low stock products
   */
  static async getLowStockProducts(userId: string): Promise<ServiceResponse<Product[]>> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('track_inventory', true)
        .eq('is_active', true)
        .filter('quantity_on_hand', 'lte', 'reorder_point')
        .order('quantity_on_hand', { ascending: true });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('Error fetching low stock products:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get inventory value
   */
  static async getInventoryValue(userId: string): Promise<ServiceResponse<{
    totalCost: number;
    totalRetail: number;
    items: number;
  }>> {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('cost, unit_price, quantity_on_hand')
        .eq('user_id', userId)
        .eq('track_inventory', true)
        .eq('is_active', true);

      if (error) throw error;

      const value = products?.reduce((acc, product) => {
        const quantity = product.quantity_on_hand || 0;
        return {
          totalCost: acc.totalCost + (product.cost || 0) * quantity,
          totalRetail: acc.totalRetail + product.unit_price * quantity,
          items: acc.items + quantity
        };
      }, { totalCost: 0, totalRetail: 0, items: 0 }) || { totalCost: 0, totalRetail: 0, items: 0 };

      return { success: true, data: value };
    } catch (error: any) {
      console.error('Error calculating inventory value:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate product quantity from stock movements
   * Useful for fixing data inconsistencies
   */
  static async recalculateQuantityFromMovements(
    productId: string
  ): Promise<ServiceResponse<number>> {
    try {
      // Get all stock movements for this product
      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select('quantity')
        .eq('product_id', productId)
        .order('movement_date', { ascending: true });

      if (error) throw error;

      // Calculate total quantity from movements
      const calculatedQuantity = movements?.reduce((sum, movement) => {
        return sum + movement.quantity;
      }, 0) || 0;

      // Update product quantity
      const { error: updateError } = await supabase
        .from('products')
        .update(withTimestamp({ quantity_on_hand: calculatedQuantity }))
        .eq('id', productId);

      if (updateError) throw updateError;

      return {
        success: true,
        data: calculatedQuantity,
        message: `Quantity recalculated: ${calculatedQuantity} units`
      };
    } catch (error: any) {
      console.error('Error recalculating quantity:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Recalculate quantities for all products from their stock movements
   */
  static async recalculateAllQuantities(
    userId: string
  ): Promise<ServiceResponse<{ updated: number; skipped: number }>> {
    try {
      // Get all products that track inventory
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', userId)
        .eq('track_inventory', true)
        .eq('is_active', true);

      if (productsError) throw productsError;

      let updated = 0;
      let skipped = 0;

      for (const product of products || []) {
        const result = await this.recalculateQuantityFromMovements(product.id);
        if (result.success) {
          updated++;
        } else {
          skipped++;
        }
      }

      return {
        success: true,
        data: { updated, skipped },
        message: `Recalculated ${updated} products, skipped ${skipped}`
      };
    } catch (error: any) {
      console.error('Error recalculating all quantities:', error);
      return { success: false, error: error.message };
    }
  }
}

