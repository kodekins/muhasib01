/**
 * Category Service
 * Handles transaction category management
 * All business logic in application code
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse, Category } from './types';

export class CategoryService {
  /**
   * Get all categories for a user
   */
  static async getCategories(
    userId: string,
    filters?: {
      active?: boolean;
    }
  ): Promise<ServiceResponse<Category[]>> {
    try {
      let query = supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('name');

      if (filters?.active !== undefined) {
        query = query.eq('is_active', filters.active);
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
        error: error.message || 'Failed to fetch categories'
      };
    }
  }

  /**
   * Get single category by ID
   */
  static async getCategoryById(categoryId: string): Promise<ServiceResponse<Category>> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Category not found'
      };
    }
  }

  /**
   * Create new category
   */
  static async createCategory(category: {
    user_id: string;
    name: string;
    description?: string;
    color?: string;
    parent_category_id?: string;
  }): Promise<ServiceResponse<Category>> {
    try {
      // Validation: Check if name already exists for this user
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', category.user_id)
        .eq('name', category.name)
        .single();

      if (existing) {
        return {
          success: false,
          error: `Category "${category.name}" already exists`
        };
      }

      // Validation: Ensure color is valid hex
      if (category.color && !/^#[0-9A-F]{6}$/i.test(category.color)) {
        return {
          success: false,
          error: 'Color must be a valid hex code (e.g., #FF5733)'
        };
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          user_id: category.user_id,
          name: category.name,
          description: category.description,
          color: category.color || '#6366f1',
          parent_category_id: category.parent_category_id,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Category created successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create category'
      };
    }
  }

  /**
   * Update category
   */
  static async updateCategory(
    categoryId: string,
    updates: Partial<Category>
  ): Promise<ServiceResponse<Category>> {
    try {
      // If updating name, check uniqueness
      if (updates.name) {
        const { data: currentCategory } = await supabase
          .from('categories')
          .select('user_id')
          .eq('id', categoryId)
          .single();

        if (currentCategory) {
          const { data: existing } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', currentCategory.user_id)
            .eq('name', updates.name)
            .neq('id', categoryId)
            .single();

          if (existing) {
            return {
              success: false,
              error: `Category "${updates.name}" already exists`
            };
          }
        }
      }

      // Validate color if provided
      if (updates.color && !/^#[0-9A-F]{6}$/i.test(updates.color)) {
        return {
          success: false,
          error: 'Color must be a valid hex code'
        };
      }

      const { data, error } = await supabase
        .from('categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data,
        message: 'Category updated successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update category'
      };
    }
  }

  /**
   * Delete category
   * Business logic: Check if category is used in transactions
   */
  static async deleteCategory(categoryId: string): Promise<ServiceResponse<void>> {
    try {
      // Check if category has transactions
      const { data: transactions, error: checkError } = await supabase
        .from('transactions')
        .select('id')
        .eq('category_id', categoryId)
        .limit(1);

      if (checkError) throw checkError;

      if (transactions && transactions.length > 0) {
        return {
          success: false,
          error: 'Cannot delete category with existing transactions'
        };
      }

      // Delete category
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      return {
        success: true,
        message: 'Category deleted successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete category'
      };
    }
  }

  /**
   * Get category spending statistics
   * Business logic: Calculates total spending per category
   */
  static async getCategorySpending(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    total_amount: number;
    transaction_count: number;
  }>>> {
    try {
      // Build query
      let query = supabase
        .from('transactions')
        .select('category_id, amount, categories(name, color)')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('transaction_date', startDate);
      }

      if (endDate) {
        query = query.lte('transaction_date', endDate);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Group and calculate in application code
      const categoryMap = new Map<string, {
        name: string;
        color: string;
        total: number;
        count: number;
      }>();

      transactions?.forEach((txn: any) => {
        if (!txn.category_id) return;

        const existing = categoryMap.get(txn.category_id) || {
          name: txn.categories?.name || 'Unknown',
          color: txn.categories?.color || '#6366f1',
          total: 0,
          count: 0
        };

        existing.total += txn.amount;
        existing.count += 1;

        categoryMap.set(txn.category_id, existing);
      });

      // Convert to array
      const results = Array.from(categoryMap.entries()).map(([id, stats]) => ({
        category_id: id,
        category_name: stats.name,
        category_color: stats.color,
        total_amount: stats.total,
        transaction_count: stats.count
      }));

      // Sort by total amount (descending)
      results.sort((a, b) => Math.abs(b.total_amount) - Math.abs(a.total_amount));

      return {
        success: true,
        data: results
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to calculate category spending'
      };
    }
  }

  /**
   * Get top spending categories
   * Business logic: Returns top N categories by spending
   */
  static async getTopCategories(
    userId: string,
    limit: number = 5,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    total_amount: number;
    percentage: number;
  }>>> {
    try {
      const spendingResult = await this.getCategorySpending(userId, startDate, endDate);

      if (!spendingResult.success || !spendingResult.data) {
        return spendingResult as any;
      }

      const totalSpending = spendingResult.data.reduce(
        (sum, cat) => sum + Math.abs(cat.total_amount),
        0
      );

      const topCategories = spendingResult.data
        .slice(0, limit)
        .map(cat => ({
          category_id: cat.category_id,
          category_name: cat.category_name,
          category_color: cat.category_color,
          total_amount: cat.total_amount,
          percentage: totalSpending > 0
            ? (Math.abs(cat.total_amount) / totalSpending) * 100
            : 0
        }));

      return {
        success: true,
        data: topCategories
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get top categories'
      };
    }
  }
}

