/**
 * Report Service
 * Handles financial reporting and summary calculations
 */

import { supabase } from '@/integrations/supabase/client';
import { FinancialSummary, ServiceResponse } from './types';

export class ReportService {
  /**
   * Get financial summary for a user (from Chart of Accounts - proper double-entry bookkeeping)
   */
  static async getFinancialSummary(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ServiceResponse<FinancialSummary>> {
    try {
      // Build query for journal entry lines with date filter
      let journalEntriesQuery = supabase
        .from('journal_entries')
        .select('id, entry_date')
        .eq('user_id', userId)
        .eq('status', 'posted');

      if (startDate) {
        journalEntriesQuery = journalEntriesQuery.gte('entry_date', startDate);
      }
      if (endDate) {
        journalEntriesQuery = journalEntriesQuery.lte('entry_date', endDate);
      }

      const { data: journalEntries, error: journalError } = await journalEntriesQuery;

      if (journalError) throw journalError;

      // Get journal entry IDs
      const journalEntryIds = journalEntries?.map(je => je.id) || [];

      if (journalEntryIds.length === 0) {
        return {
          success: true,
          data: {
            totalRevenue: 0,
            totalExpenses: 0,
            netIncome: 0,
            totalAssets: 0,
            totalLiabilities: 0,
            totalEquity: 0
          }
        };
      }

      // Fetch journal entry lines for these entries
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          account:accounts(code, account_type)
        `)
        .in('journal_entry_id', journalEntryIds);

      if (linesError) throw linesError;

      const summary: FinancialSummary = {
        totalRevenue: 0,
        totalExpenses: 0,
        netIncome: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0
      };

      // Calculate from Chart of Accounts using proper double-entry bookkeeping
      journalLines?.forEach((line: any) => {
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);
        const accountCode = line.account?.code;
        const accountType = line.account?.account_type;

        if (!accountCode) return;

        // Revenue accounts (4000-4999): Credits increase revenue
        if (accountType === 'revenue' || (accountCode >= '4000' && accountCode < '5000')) {
          summary.totalRevenue += credit;
        }
        
        // Expense accounts (5000-5999): Debits increase expenses
        else if (accountType === 'expense' || (accountCode >= '5000' && accountCode < '6000')) {
          summary.totalExpenses += debit;
        }
        
        // Asset accounts (1000-1999): Debits increase, Credits decrease
        else if (accountType === 'asset' || (accountCode >= '1000' && accountCode < '2000')) {
          summary.totalAssets += (debit - credit);
        }
        
        // Liability accounts (2000-2999): Credits increase, Debits decrease
        else if (accountType === 'liability' || (accountCode >= '2000' && accountCode < '3000')) {
          summary.totalLiabilities += (credit - debit);
        }
        
        // Equity accounts (3000-3999): Credits increase, Debits decrease
        else if (accountType === 'equity' || (accountCode >= '3000' && accountCode < '4000')) {
          summary.totalEquity += (credit - debit);
        }
      });

      summary.netIncome = summary.totalRevenue - summary.totalExpenses;

      return { success: true, data: summary };
    } catch (error: any) {
      console.error('Error getting financial summary:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Profit & Loss report (from Chart of Accounts)
   */
  static async generateProfitLoss(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResponse<{
    revenue: { [key: string]: number };
    expenses: { [key: string]: number };
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
  }>> {
    try {
      // Get journal entries within date range
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'posted')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (journalError) throw journalError;

      const journalEntryIds = journalEntries?.map(je => je.id) || [];

      if (journalEntryIds.length === 0) {
        return {
          success: true,
          data: {
            revenue: {},
            expenses: {},
            totalRevenue: 0,
            totalExpenses: 0,
            netIncome: 0
          }
        };
      }

      // Fetch journal entry lines with account info
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          account:accounts(name, code, account_type)
        `)
        .in('journal_entry_id', journalEntryIds);

      if (linesError) throw linesError;

      const revenue: { [key: string]: number } = {};
      const expenses: { [key: string]: number } = {};
      let totalRevenue = 0;
      let totalExpenses = 0;

      journalLines?.forEach((line: any) => {
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);
        const accountType = line.account?.account_type;
        const accountName = line.account?.name || 'Uncategorized';
        const accountCode = line.account?.code;

        // Revenue accounts (4000-4999): Credits increase revenue
        if (accountType === 'revenue' || (accountCode >= '4000' && accountCode < '5000')) {
          if (credit > 0) {
            revenue[accountName] = (revenue[accountName] || 0) + credit;
            totalRevenue += credit;
          }
        }
        
        // Expense accounts (5000-5999): Debits increase expenses
        else if (accountType === 'expense' || (accountCode >= '5000' && accountCode < '6000')) {
          if (debit > 0) {
            expenses[accountName] = (expenses[accountName] || 0) + debit;
            totalExpenses += debit;
          }
        }
      });

      return {
        success: true,
        data: {
          revenue,
          expenses,
          totalRevenue,
          totalExpenses,
          netIncome: totalRevenue - totalExpenses
        }
      };
    } catch (error: any) {
      console.error('Error generating P&L report:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Balance Sheet (from Chart of Accounts)
   */
  static async generateBalanceSheet(
    userId: string,
    asOfDate: string
  ): Promise<ServiceResponse<{
    assets: { [key: string]: number };
    liabilities: { [key: string]: number };
    equity: { [key: string]: number };
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  }>> {
    try {
      // Get journal entries up to the date
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'posted')
        .lte('entry_date', asOfDate);

      if (journalError) throw journalError;

      const journalEntryIds = journalEntries?.map(je => je.id) || [];

      if (journalEntryIds.length === 0) {
        return {
          success: true,
          data: {
            assets: {},
            liabilities: {},
            equity: {},
            totalAssets: 0,
            totalLiabilities: 0,
            totalEquity: 0
          }
        };
      }

      // Fetch journal entry lines with account info
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          account:accounts(name, code, account_type)
        `)
        .in('journal_entry_id', journalEntryIds);

      if (linesError) throw linesError;

      const assets: { [key: string]: number } = {};
      const liabilities: { [key: string]: number } = {};
      const equity: { [key: string]: number } = {};
      let totalAssets = 0;
      let totalLiabilities = 0;
      let totalEquity = 0;

      journalLines?.forEach((line: any) => {
        const debit = parseFloat(line.debit || 0);
        const credit = parseFloat(line.credit || 0);
        const accountType = line.account?.account_type;
        const accountName = line.account?.name || 'Uncategorized';
        const accountCode = line.account?.code;

        // Asset accounts (1000-1999): Debits increase, Credits decrease
        if (accountType === 'asset' || (accountCode >= '1000' && accountCode < '2000')) {
          const balance = debit - credit;
          assets[accountName] = (assets[accountName] || 0) + balance;
          totalAssets += balance;
        }
        
        // Liability accounts (2000-2999): Credits increase, Debits decrease
        else if (accountType === 'liability' || (accountCode >= '2000' && accountCode < '3000')) {
          const balance = credit - debit;
          liabilities[accountName] = (liabilities[accountName] || 0) + balance;
          totalLiabilities += balance;
        }
        
        // Equity accounts (3000-3999): Credits increase, Debits decrease
        else if (accountType === 'equity' || (accountCode >= '3000' && accountCode < '4000')) {
          const balance = credit - debit;
          equity[accountName] = (equity[accountName] || 0) + balance;
          totalEquity += balance;
        }
      });

      return {
        success: true,
        data: {
          assets,
          liabilities,
          equity,
          totalAssets,
          totalLiabilities,
          totalEquity
        }
      };
    } catch (error: any) {
      console.error('Error generating balance sheet:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get spending by category
   */
  static async getSpendingByCategory(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResponse<Array<{ category: string; amount: number; count: number }>>> {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, category:categories(name, color)')
        .eq('user_id', userId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .lt('amount', 0); // Only expenses

      if (error) throw error;

      const categoryMap: { [key: string]: { amount: number; count: number } } = {};

      transactions?.forEach((transaction: any) => {
        const categoryName = transaction.category?.name || 'Uncategorized';
        const amount = Math.abs(parseFloat(transaction.amount));

        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = { amount: 0, count: 0 };
        }

        categoryMap[categoryName].amount += amount;
        categoryMap[categoryName].count += 1;
      });

      const result = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count
        }))
        .sort((a, b) => b.amount - a.amount);

      return { success: true, data: result };
    } catch (error: any) {
      console.error('Error getting spending by category:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get monthly trends
   */
  static async getMonthlyTrends(
    userId: string,
    year: number
  ): Promise<ServiceResponse<Array<{
    month: string;
    revenue: number;
    expenses: number;
    netIncome: number;
  }>>> {
    try {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const trends = [];

      for (let i = 0; i < 12; i++) {
        const startDate = `${year}-${String(i + 1).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(i + 1).padStart(2, '0')}-31`;

        const summary = await this.getFinancialSummary(userId, startDate, endDate);

        trends.push({
          month: months[i],
          revenue: summary.data?.totalRevenue || 0,
          expenses: summary.data?.totalExpenses || 0,
          netIncome: summary.data?.netIncome || 0
        });
      }

      return { success: true, data: trends };
    } catch (error: any) {
      console.error('Error getting monthly trends:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Cash Flow Statement (from Chart of Accounts)
   */
  static async generateCashFlow(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ServiceResponse<{
    operatingActivities: { [key: string]: number };
    investingActivities: { [key: string]: number };
    financingActivities: { [key: string]: number };
    netOperating: number;
    netInvesting: number;
    netFinancing: number;
    netCashFlow: number;
    beginningCash: number;
    endingCash: number;
  }>> {
    try {
      // Get beginning cash balance (before start date)
      const { data: beginningJournalEntries, error: beginningError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'posted')
        .lt('entry_date', startDate);

      if (beginningError) throw beginningError;

      const beginningJournalIds = beginningJournalEntries?.map(je => je.id) || [];
      
      let beginningCash = 0;
      if (beginningJournalIds.length > 0) {
        const { data: beginningLines, error: beginningLinesError } = await supabase
          .from('journal_entry_lines')
          .select('debit, credit, account:accounts(code, name)')
          .in('journal_entry_id', beginningJournalIds);

        if (beginningLinesError) throw beginningLinesError;

        beginningLines?.forEach((line: any) => {
          const accountCode = line.account?.code;
          // Cash and Bank accounts (1000-1099)
          if (accountCode >= '1000' && accountCode < '1100') {
            beginningCash += (parseFloat(line.debit || 0) - parseFloat(line.credit || 0));
          }
        });
      }

      // Get journal entries for the period
      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'posted')
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (journalError) throw journalError;

      const journalEntryIds = journalEntries?.map(je => je.id) || [];

      if (journalEntryIds.length === 0) {
        return {
          success: true,
          data: {
            operatingActivities: {},
            investingActivities: {},
            financingActivities: {},
            netOperating: 0,
            netInvesting: 0,
            netFinancing: 0,
            netCashFlow: 0,
            beginningCash,
            endingCash: beginningCash
          }
        };
      }

      // Fetch journal entry lines
      const { data: journalLines, error: linesError } = await supabase
        .from('journal_entry_lines')
        .select(`
          debit,
          credit,
          journal_entry_id,
          account:accounts(code, name, account_type)
        `)
        .in('journal_entry_id', journalEntryIds);

      if (linesError) throw linesError;

      const operatingActivities: { [key: string]: number } = {};
      const investingActivities: { [key: string]: number } = {};
      const financingActivities: { [key: string]: number } = {};
      
      let netOperating = 0;
      let netInvesting = 0;
      let netFinancing = 0;
      let endingCash = beginningCash;

      // Group lines by journal entry to track cash movements
      const entriesMap = new Map<string, any[]>();
      journalLines?.forEach((line: any) => {
        if (!entriesMap.has(line.journal_entry_id)) {
          entriesMap.set(line.journal_entry_id, []);
        }
        entriesMap.get(line.journal_entry_id)?.push(line);
      });

      // Process each journal entry
      entriesMap.forEach((lines) => {
        let cashEffect = 0;
        let otherAccountCode = '';
        let otherAccountName = '';
        
        lines.forEach((line: any) => {
          const debit = parseFloat(line.debit || 0);
          const credit = parseFloat(line.credit || 0);
          const accountCode = line.account?.code;
          const accountName = line.account?.name || 'Unknown';

          // Track cash account movements (1000-1099)
          if (accountCode >= '1000' && accountCode < '1100') {
            cashEffect += (debit - credit);
          } else {
            otherAccountCode = accountCode;
            otherAccountName = accountName;
          }
        });

        if (cashEffect !== 0 && otherAccountCode) {
          const description = otherAccountName;
          
          // Operating Activities: Revenue & Expenses (4000-5999), AR, AP
          if ((otherAccountCode >= '1200' && otherAccountCode < '1300') || // AR
              (otherAccountCode >= '2000' && otherAccountCode < '2100') || // AP
              (otherAccountCode >= '4000' && otherAccountCode < '6000')) { // Revenue/Expense
            operatingActivities[description] = (operatingActivities[description] || 0) + cashEffect;
            netOperating += cashEffect;
          }
          // Investing Activities: Fixed Assets (1500-1999)
          else if (otherAccountCode >= '1500' && otherAccountCode < '2000') {
            investingActivities[description] = (investingActivities[description] || 0) + cashEffect;
            netInvesting += cashEffect;
          }
          // Financing Activities: Long-term Liabilities & Equity (2500-3999)
          else if (otherAccountCode >= '2500' && otherAccountCode < '4000') {
            financingActivities[description] = (financingActivities[description] || 0) + cashEffect;
            netFinancing += cashEffect;
          }
          // Default to operating
          else {
            operatingActivities[description] = (operatingActivities[description] || 0) + cashEffect;
            netOperating += cashEffect;
          }
          
          endingCash += cashEffect;
        }
      });

      const netCashFlow = netOperating + netInvesting + netFinancing;

      return {
        success: true,
        data: {
          operatingActivities,
          investingActivities,
          financingActivities,
          netOperating,
          netInvesting,
          netFinancing,
          netCashFlow,
          beginningCash,
          endingCash
        }
      };
    } catch (error: any) {
      console.error('Error generating cash flow:', error);
      return { success: false, error: error.message };
    }
  }
}

