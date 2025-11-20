export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          user_id: string
          name: string
          code: string
          account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
          parent_account_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['accounts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['accounts']['Insert']>
      }
      customers: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          company_name: string | null
          address: string | null
          tax_number: string | null
          customer_type: string
          payment_terms: number
          credit_limit: number
          balance: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      vendors: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          phone: string | null
          company_name: string | null
          address: string | null
          tax_number: string | null
          vendor_type: string
          payment_terms: number
          balance: number
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['vendors']['Insert']>
      }
      products: {
        Row: {
          id: string
          user_id: string
          type: 'service' | 'product' | 'inventory'
          name: string
          sku: string | null
          description: string | null
          unit_price: number
          cost: number | null
          income_account_id: string | null
          expense_account_id: string | null
          inventory_account_id: string | null
          track_inventory: boolean
          quantity_on_hand: number
          reorder_point: number | null
          taxable: boolean
          tax_rate: number
          unit_of_measure: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          document_type: 'invoice' | 'quotation'
          invoice_number: string | null
          quotation_number: string | null
          invoice_date: string
          due_date: string
          status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void' | 'accepted' | 'declined'
          subtotal: number
          tax_amount: number
          discount_amount: number | null
          total_amount: number
          amount_paid: number
          balance_due: number
          notes: string | null
          terms: string | null
          sent_at: string | null
          journal_entry_id: string | null
          converted_to_invoice_id: string | null
          converted_from_quotation_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>
      }
      invoice_lines: {
        Row: {
          id: string
          invoice_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          tax_rate: number | null
          discount_percent: number | null
          account_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invoice_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invoice_lines']['Insert']>
      }
      bills: {
        Row: {
          id: string
          user_id: string
          vendor_id: string
          bill_number: string
          bill_date: string
          due_date: string
          status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void'
          subtotal: number
          tax_amount: number
          discount_amount: number | null
          total_amount: number
          amount_paid: number
          balance_due: number
          notes: string | null
          terms: string | null
          journal_entry_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bills']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bills']['Insert']>
      }
      payments: {
        Row: {
          id: string
          user_id: string
          payment_number: string | null
          payment_date: string
          payment_type: 'invoice_payment' | 'bill_payment' | 'customer_refund' | 'vendor_refund'
          payment_method: 'cash' | 'check' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'ach' | 'other'
          customer_id: string | null
          vendor_id: string | null
          amount: number
          bank_account_id: string | null
          reference_number: string | null
          journal_entry_id: string | null
          notes: string | null
          status: 'pending' | 'completed' | 'void' | 'failed'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['payments']['Insert']>
      }
      payment_applications: {
        Row: {
          id: string
          payment_id: string
          invoice_id: string | null
          bill_id: string | null
          amount_applied: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['payment_applications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['payment_applications']['Insert']>
      }
      journal_entries: {
        Row: {
          id: string
          user_id: string
          entry_number: string | null
          entry_date: string
          reference: string | null
          description: string
          status: 'draft' | 'posted' | 'void'
          source_type: string | null
          source_id: string | null
          created_by: string | null
          posted_at: string | null
          voided_at: string | null
          notes: string | null
          total_debits: number
          total_credits: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['journal_entries']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['journal_entries']['Insert']>
      }
      journal_entry_lines: {
        Row: {
          id: string
          journal_entry_id: string
          account_id: string
          debit: number
          credit: number
          description: string | null
          entity_type: string | null
          entity_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['journal_entry_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['journal_entry_lines']['Insert']>
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          description: string
          amount: number
          transaction_date: string
          account_id: string
          category_id: string | null
          status: 'pending' | 'cleared' | 'reconciled' | 'posted'
          reference_number: string | null
          notes: string | null
          customer_id: string | null
          vendor_id: string | null
          transaction_type: string | null
          reference_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>
      }
      budgets: {
        Row: {
          id: string
          user_id: string
          name: string
          category_id: string | null
          amount: number
          period: string
          start_date: string
          end_date: string
          spent_amount: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          company_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      attachments: {
        Row: {
          id: string
          transaction_id: string
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['attachments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['attachments']['Insert']>
      }
      sales_orders: {
        Row: {
          id: string
          user_id: string
          customer_id: string
          order_number: string
          order_date: string
          expected_delivery_date: string | null
          status: 'draft' | 'confirmed' | 'converted' | 'cancelled'
          subtotal: number
          tax_amount: number
          discount_amount: number
          total_amount: number
          notes: string | null
          terms: string | null
          converted_invoice_id: string | null
          converted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sales_orders']['Insert']>
      }
      sales_order_lines: {
        Row: {
          id: string
          sales_order_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          discount_percent: number
          tax_rate: number
          amount: number
          account_id: string | null
          line_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales_order_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sales_order_lines']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          user_id: string
          vendor_id: string
          order_number: string
          order_date: string
          expected_delivery_date: string | null
          status: 'draft' | 'sent' | 'converted' | 'cancelled'
          subtotal: number
          tax_amount: number
          total_amount: number
          notes: string | null
          terms: string | null
          shipping_address: string | null
          converted_bill_id: string | null
          converted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_order_lines: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          amount: number
          account_id: string | null
          line_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_order_lines']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_order_lines']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
