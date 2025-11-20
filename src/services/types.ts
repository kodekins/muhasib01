// Shared types for services
export interface ServiceResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

export interface Transaction {
  id?: string;
  user_id: string;
  conversation_id?: string;
  description: string;
  amount: number;
  transaction_date: string;
  account_id: string;
  category_id?: string;
  customer_id?: string;
  vendor_id?: string;
  status: 'pending' | 'cleared' | 'reconciled';
  reference_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Budget {
  id?: string;
  user_id: string;
  name: string;
  category_id?: string;
  account_id?: string;
  budget_type: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  spent_amount?: number;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id?: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  tax_number?: string;
  payment_terms?: number;
  credit_limit?: number;
  balance?: number;
  customer_type: 'customer' | 'client';
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Vendor {
  id?: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  company_name?: string;
  tax_number?: string;
  payment_terms?: number;
  credit_limit?: number;
  balance?: number;
  vendor_type: 'vendor' | 'supplier';
  is_active?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

