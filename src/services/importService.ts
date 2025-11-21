/**
 * Import Service
 * Handles CSV import functionality for various entities
 */

import { supabase } from '@/integrations/supabase/client';
import { ServiceResponse } from './types';
import Papa from 'papaparse';

export type ImportEntityType = 
  | 'customers' 
  | 'vendors' 
  | 'products' 
  | 'accounts' 
  | 'categories';

export interface ImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
}

export interface ImportMapping {
  csvColumn: string;
  dbColumn: string;
  required?: boolean;
  transform?: (value: any) => any;
}

export interface CSVPreview {
  headers: string[];
  data: any[];
  rowCount: number;
}

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

export class ImportService {
  /**
   * Parse CSV file and get preview
   */
  static async parseCSVWithPreview(file: File): Promise<ServiceResponse<CSVPreview>> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        preview: 5, // Preview first 5 rows
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              error: 'CSV parsing errors',
              errors: results.errors.map(e => e.message)
            });
          } else {
            const headers = results.meta.fields || [];
            resolve({ 
              success: true, 
              data: {
                headers,
                data: results.data,
                rowCount: results.data.length
              }
            });
          }
        },
        error: (error) => {
          resolve({ success: false, error: error.message });
        }
      });
    });
  }

  /**
   * Parse CSV file (full data)
   */
  static async parseCSV(file: File): Promise<ServiceResponse<any[]>> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              success: false,
              error: 'CSV parsing errors',
              errors: results.errors.map(e => e.message)
            });
          } else {
            resolve({ success: true, data: results.data });
          }
        },
        error: (error) => {
          resolve({ success: false, error: error.message });
        }
      });
    });
  }

  /**
   * Get available database fields for an entity type
   */
  static getAvailableFields(entityType: ImportEntityType): Array<{ value: string; label: string; required?: boolean }> {
    const fields: Record<ImportEntityType, Array<{ value: string; label: string; required?: boolean }>> = {
      customers: [
        { value: 'name', label: 'Name', required: true },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'address', label: 'Address' },
        { value: 'company_name', label: 'Company Name' },
        { value: 'tax_number', label: 'Tax Number' },
        { value: 'payment_terms', label: 'Payment Terms (days)' },
        { value: 'credit_limit', label: 'Credit Limit' },
        { value: 'notes', label: 'Notes' }
      ],
      vendors: [
        { value: 'name', label: 'Name', required: true },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
        { value: 'address', label: 'Address' },
        { value: 'company_name', label: 'Company Name' },
        { value: 'tax_number', label: 'Tax Number' },
        { value: 'payment_terms', label: 'Payment Terms (days)' },
        { value: 'credit_limit', label: 'Credit Limit' },
        { value: 'notes', label: 'Notes' }
      ],
      products: [
        { value: 'name', label: 'Name', required: true },
        { value: 'type', label: 'Type (service/product/inventory)' },
        { value: 'sku', label: 'SKU' },
        { value: 'description', label: 'Description' },
        { value: 'unit_price', label: 'Unit Price', required: true },
        { value: 'cost', label: 'Cost' },
        { value: 'track_inventory', label: 'Track Inventory (yes/no)' },
        { value: 'quantity_on_hand', label: 'Quantity on Hand' },
        { value: 'reorder_point', label: 'Reorder Point' },
        { value: 'taxable', label: 'Taxable (yes/no)' },
        { value: 'tax_rate', label: 'Tax Rate (%)' },
        { value: 'unit_of_measure', label: 'Unit of Measure' }
      ],
      accounts: [
        { value: 'name', label: 'Name', required: true },
        { value: 'code', label: 'Account Code' },
        { value: 'account_type', label: 'Type (asset/liability/equity/revenue/expense)', required: true },
        { value: 'description', label: 'Description' }
      ],
      categories: [
        { value: 'name', label: 'Name', required: true },
        { value: 'description', label: 'Description' },
        { value: 'color', label: 'Color (hex code)' }
      ]
    };

    return fields[entityType];
  }

  /**
   * Get column mappings for each entity type (for template generation)
   */
  static getColumnMappings(entityType: ImportEntityType): ImportMapping[] {
    const mappings: Record<ImportEntityType, ImportMapping[]> = {
      customers: [
        { csvColumn: 'Name', dbColumn: 'name', required: true },
        { csvColumn: 'Email', dbColumn: 'email' },
        { csvColumn: 'Phone', dbColumn: 'phone' },
        { csvColumn: 'Address', dbColumn: 'address' },
        { csvColumn: 'Company Name', dbColumn: 'company_name' },
        { csvColumn: 'Tax Number', dbColumn: 'tax_number' },
        { 
          csvColumn: 'Payment Terms', 
          dbColumn: 'payment_terms',
          transform: (v) => v ? parseInt(v) || 30 : 30
        },
        { 
          csvColumn: 'Credit Limit', 
          dbColumn: 'credit_limit',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { csvColumn: 'Notes', dbColumn: 'notes' }
      ],
      vendors: [
        { csvColumn: 'Name', dbColumn: 'name', required: true },
        { csvColumn: 'Email', dbColumn: 'email' },
        { csvColumn: 'Phone', dbColumn: 'phone' },
        { csvColumn: 'Address', dbColumn: 'address' },
        { csvColumn: 'Company Name', dbColumn: 'company_name' },
        { csvColumn: 'Tax Number', dbColumn: 'tax_number' },
        { 
          csvColumn: 'Payment Terms', 
          dbColumn: 'payment_terms',
          transform: (v) => v ? parseInt(v) || 30 : 30
        },
        { 
          csvColumn: 'Credit Limit', 
          dbColumn: 'credit_limit',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { csvColumn: 'Notes', dbColumn: 'notes' }
      ],
      products: [
        { csvColumn: 'Name', dbColumn: 'name', required: true },
        { 
          csvColumn: 'Type', 
          dbColumn: 'type',
          transform: (v) => {
            const type = v?.toLowerCase();
            return ['service', 'product', 'inventory'].includes(type) 
              ? type 
              : 'service';
          }
        },
        { csvColumn: 'SKU', dbColumn: 'sku' },
        { csvColumn: 'Description', dbColumn: 'description' },
        { 
          csvColumn: 'Unit Price', 
          dbColumn: 'unit_price',
          required: true,
          transform: (v) => parseFloat(v) || 0
        },
        { 
          csvColumn: 'Cost', 
          dbColumn: 'cost',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { 
          csvColumn: 'Track Inventory', 
          dbColumn: 'track_inventory',
          transform: (v) => v?.toLowerCase() === 'yes' || v?.toLowerCase() === 'true'
        },
        { 
          csvColumn: 'Quantity on Hand', 
          dbColumn: 'quantity_on_hand',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { 
          csvColumn: 'Reorder Point', 
          dbColumn: 'reorder_point',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { 
          csvColumn: 'Taxable', 
          dbColumn: 'taxable',
          transform: (v) => v?.toLowerCase() !== 'no' && v?.toLowerCase() !== 'false'
        },
        { 
          csvColumn: 'Tax Rate', 
          dbColumn: 'tax_rate',
          transform: (v) => v ? parseFloat(v) || 0 : 0
        },
        { csvColumn: 'Unit of Measure', dbColumn: 'unit_of_measure' }
      ],
      accounts: [
        { csvColumn: 'Name', dbColumn: 'name', required: true },
        { csvColumn: 'Code', dbColumn: 'code' },
        { 
          csvColumn: 'Type', 
          dbColumn: 'account_type',
          required: true,
          transform: (v) => {
            const type = v?.toLowerCase();
            return ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type) 
              ? type 
              : 'asset';
          }
        },
        { csvColumn: 'Parent Account Code', dbColumn: 'parent_account_code' },
        { csvColumn: 'Description', dbColumn: 'description' }
      ],
      categories: [
        { csvColumn: 'Name', dbColumn: 'name', required: true },
        { csvColumn: 'Description', dbColumn: 'description' },
        { csvColumn: 'Color', dbColumn: 'color', transform: (v) => v || '#6366f1' }
      ]
    };

    return mappings[entityType];
  }

  /**
   * Transform CSV row using user's column mappings
   */
  static transformRowWithMapping(
    row: any,
    columnMappings: ColumnMapping[],
    entityType: ImportEntityType,
    userId: string
  ): { data: any; errors: string[] } {
    const data: any = { user_id: userId };
    const errors: string[] = [];
    const availableFields = this.getAvailableFields(entityType);
    const requiredFields = availableFields.filter(f => f.required).map(f => f.value);

    // Apply transformations based on field type
    const transformValue = (dbField: string, value: any) => {
      if (!value || value === '') return null;

      // Number fields
      if (['unit_price', 'cost', 'credit_limit', 'quantity_on_hand', 'reorder_point', 'tax_rate'].includes(dbField)) {
        return parseFloat(value) || 0;
      }

      // Integer fields
      if (['payment_terms'].includes(dbField)) {
        return parseInt(value) || 30;
      }

      // Boolean fields
      if (['track_inventory', 'taxable'].includes(dbField)) {
        const v = value.toString().toLowerCase();
        return v === 'yes' || v === 'true' || v === '1';
      }

      // Type fields with validation
      if (dbField === 'type') {
        const type = value.toLowerCase();
        return ['service', 'product', 'inventory'].includes(type) ? type : 'service';
      }

      if (dbField === 'account_type') {
        const type = value.toLowerCase();
        return ['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type) ? type : 'asset';
      }

      // Color field
      if (dbField === 'color') {
        return value || '#6366f1';
      }

      return value;
    };

    // Map columns
    for (const mapping of columnMappings) {
      if (!mapping.dbField || mapping.dbField === '' || mapping.dbField === 'skip') continue; // Skip unmapped columns

      const value = row[mapping.csvColumn];
      const transformedValue = transformValue(mapping.dbField, value);

      if (transformedValue !== null && transformedValue !== undefined && transformedValue !== '') {
        data[mapping.dbField] = transformedValue;
      }
    }

    // Check required fields
    for (const requiredField of requiredFields) {
      if (!data[requiredField]) {
        errors.push(`${requiredField} is required`);
      }
    }

    return { data, errors };
  }

  /**
   * Transform CSV row to database object (legacy - for template-based import)
   */
  static transformRow(
    row: any,
    mappings: ImportMapping[],
    userId: string
  ): { data: any; errors: string[] } {
    const data: any = { user_id: userId };
    const errors: string[] = [];

    for (const mapping of mappings) {
      const value = row[mapping.csvColumn];

      // Check required fields
      if (mapping.required && !value) {
        errors.push(`${mapping.csvColumn} is required`);
        continue;
      }

      // Transform value if transform function exists
      const transformedValue = mapping.transform 
        ? mapping.transform(value)
        : value;

      // Only set value if it exists
      if (transformedValue !== undefined && transformedValue !== null && transformedValue !== '') {
        data[mapping.dbColumn] = transformedValue;
      }
    }

    return { data, errors };
  }

  /**
   * Generic import function with user-defined column mappings
   */
  static async importWithMapping(
    file: File,
    entityType: ImportEntityType,
    columnMappings: ColumnMapping[],
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      const tableName = entityType === 'accounts' ? 'accounts' : 
                        entityType === 'categories' ? 'categories' :
                        entityType;

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRowWithMapping(row, columnMappings, entityType, userId);

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        const { error } = await supabase
          .from(tableName)
          .insert([data]);

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import customers (legacy - for template-based import)
   */
  static async importCustomers(
    file: File,
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const mappings = this.getColumnMappings('customers');
      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRow(row, mappings, userId);

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        // Insert customer
        const { error } = await supabase
          .from('customers')
          .insert([data]);

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import vendors
   */
  static async importVendors(
    file: File,
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const mappings = this.getColumnMappings('vendors');
      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRow(row, mappings, userId);

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        const { error } = await supabase
          .from('vendors')
          .insert([data]);

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import products
   */
  static async importProducts(
    file: File,
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const mappings = this.getColumnMappings('products');
      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRow(row, mappings, userId);

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        const { error } = await supabase
          .from('products')
          .insert([data]);

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import accounts
   */
  static async importAccounts(
    file: File,
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const mappings = this.getColumnMappings('accounts');
      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      // First pass: import accounts without parent relationships
      const accountMap = new Map<string, string>(); // code -> id

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRow(row, mappings, userId);

        // Store parent code for later, but don't include in insert
        const parentCode = data.parent_account_code;
        delete data.parent_account_code;

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        const { data: inserted, error } = await supabase
          .from('accounts')
          .insert([data])
          .select('id, code')
          .single();

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
          if (inserted?.code) {
            accountMap.set(inserted.code, inserted.id);
          }
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import categories
   */
  static async importCategories(
    file: File,
    userId: string
  ): Promise<ServiceResponse<ImportResult>> {
    try {
      const parseResult = await this.parseCSV(file);
      if (!parseResult.success || !parseResult.data) {
        return parseResult;
      }

      const mappings = this.getColumnMappings('categories');
      const result: ImportResult = {
        total: parseResult.data.length,
        successful: 0,
        failed: 0,
        errors: []
      };

      for (let i = 0; i < parseResult.data.length; i++) {
        const row = parseResult.data[i];
        const { data, errors } = this.transformRow(row, mappings, userId);

        if (errors.length > 0) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: errors.join(', '),
            data: row
          });
          continue;
        }

        const { error } = await supabase
          .from('categories')
          .insert([data]);

        if (error) {
          result.failed++;
          result.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
        } else {
          result.successful++;
        }
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get CSV template for an entity type
   */
  static getCSVTemplate(entityType: ImportEntityType): string {
    const mappings = this.getColumnMappings(entityType);
    const headers = mappings.map(m => m.csvColumn);
    
    // Create example row based on entity type
    const examples: Record<ImportEntityType, string[]> = {
      customers: ['John Doe', 'john@example.com', '555-1234', '123 Main St', 'Acme Corp', 'TAX123', '30', '10000', 'VIP customer'],
      vendors: ['ABC Supplies', 'abc@supplies.com', '555-5678', '456 Oak Ave', 'ABC Inc', 'VAT456', '45', '50000', 'Primary supplier'],
      products: ['Consulting Service', 'service', 'CONS-001', '1 hour consultation', '150.00', '0', 'No', '0', '0', 'Yes', '0', 'hour'],
      accounts: ['Cash', '1000', 'asset', '', 'Main cash account'],
      categories: ['Office Supplies', 'Expenses for office supplies', '#4CAF50']
    };

    const exampleRow = examples[entityType];
    return `${headers.join(',')}\n${exampleRow.join(',')}`;
  }

  /**
   * Download CSV template
   */
  static downloadTemplate(entityType: ImportEntityType): void {
    const csv = this.getCSVTemplate(entityType);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entityType}_import_template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}

