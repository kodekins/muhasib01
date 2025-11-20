/**
 * AI Assistant Service
 * Provides AI-powered accounting assistance with natural language processing
 * This service helps the AI understand and execute accounting operations
 */

import {
  InvoiceService,
  BillService,
  TransactionService,
  ProductService,
  CustomerService,
  VendorService,
  BudgetService,
  ReportService,
  JournalEntryService
} from './index';
import { ServiceResponse } from './types';

export interface AICommand {
  action: string;
  parameters: any;
  userId: string;
  conversationId?: string;
}

export class AIAssistantService {
  /**
   * Get AI capabilities (what the AI can do)
   */
  static getCapabilities(): string {
    return `
# AI Accounting Assistant Capabilities

I can help you with complete bookkeeping and accounting tasks:

## 📊 Financial Management
- Create and manage invoices for customers
- Enter and track vendor bills
- Record payments (received and made)
- Create manual journal entries
- Track expenses and income
- Manage budgets and get spending alerts

## 👥 Relationships
- Add and manage customers/clients
- Add and manage vendors/suppliers
- Track customer balances (receivables)
- Track vendor balances (payables)
- Check credit limits

## 📦 Products & Services
- Create product/service catalog
- Set pricing and costs
- Track inventory levels
- Get low stock alerts

## 📈 Reports & Analysis
- Profit & Loss statement
- Balance Sheet
- Cash Flow analysis
- Trial Balance
- General Ledger
- Aging reports (AR/AP)
- Budget vs Actual
- Spending by category
- Monthly trends

## 🤖 AI-Powered Features
- Natural language transaction entry
- Smart categorization
- Automatic journal entries
- Invoice generation from descriptions
- Receipt OCR and data extraction
- Expense optimization suggestions
- Cash flow predictions
- Financial health insights

## 💬 Example Commands
- "Create an invoice for John Doe for $500"
- "Record a $150 expense for office supplies"
- "Show me last month's profit and loss"
- "What bills are due this week?"
- "Add a new customer named ABC Corp"
- "Create a monthly budget of $5000 for marketing"
- "Show me my aging receivables"
- "Generate a balance sheet as of today"
- "What's my cash position?"
- "Record a payment of $1000 from customer ABC"
`;
  }

  /**
   * Parse AI intent from user message
   * This helps the AI understand what the user wants to do
   */
  static async parseIntent(message: string, userId: string): Promise<{
    intent: string;
    entities: any;
    confidence: number;
  }> {
    const lowercaseMessage = message.toLowerCase();

    // Intent patterns
    const patterns = {
      create_invoice: /create|make|generate.*invoice/i,
      create_bill: /enter|record|create.*bill|vendor.*bill/i,
      record_payment: /record|received?.*payment|pay/i,
      add_customer: /add|create|new.*customer|client/i,
      add_vendor: /add|create|new.*vendor|supplier/i,
      add_product: /add|create|new.*product|service|item/i,
      create_budget: /create|set|add.*budget/i,
      record_expense: /record|enter|add.*expense|spent|paid/i,
      view_pl: /profit.*loss|p&l|p\s*&\s*l|income.*statement/i,
      view_balance_sheet: /balance.*sheet|financial.*position/i,
      view_cash_flow: /cash.*flow/i,
      view_invoices: /show|list|view.*invoices?/i,
      view_bills: /show|list|view.*bills?/i,
      view_customers: /show|list|view.*customers?|clients?/i,
      view_vendors: /show|list|view.*vendors?|suppliers?/i,
      check_budgets: /budget.*status|spending.*alert|over.*budget/i,
      aging_report: /aging|receivables|payables.*report/i,
    };

    // Determine intent
    for (const [intent, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        return {
          intent,
          entities: this.extractEntities(message, intent),
          confidence: 0.8
        };
      }
    }

    return {
      intent: 'general_query',
      entities: {},
      confidence: 0.5
    };
  }

  /**
   * Extract entities from message based on intent
   */
  private static extractEntities(message: string, intent: string): any {
    const entities: any = {};

    // Extract amounts (money values)
    const amountMatch = message.match(/\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    if (amountMatch) {
      entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    }

    // Extract names (customer/vendor names)
    const nameMatch = message.match(/for\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (nameMatch) {
      entities.name = nameMatch[1];
    }

    // Extract dates
    const datePatterns = [
      /today/i,
      /yesterday/i,
      /last\s+(week|month|year)/i,
      /this\s+(week|month|year)/i,
      /\d{4}-\d{2}-\d{2}/,
      /(january|february|march|april|may|june|july|august|september|october|november|december)/i
    ];

    for (const pattern of datePatterns) {
      const match = message.match(pattern);
      if (match) {
        entities.dateReference = match[0];
        break;
      }
    }

    // Extract categories
    const categories = [
      'office supplies', 'marketing', 'travel', 'software',
      'utilities', 'rent', 'salaries', 'consulting', 'equipment'
    ];

    for (const category of categories) {
      if (message.toLowerCase().includes(category)) {
        entities.category = category;
        break;
      }
    }

    return entities;
  }

  /**
   * Execute AI command
   */
  static async executeCommand(command: AICommand): Promise<ServiceResponse<any>> {
    try {
      switch (command.action) {
        case 'create_invoice':
          return await this.handleCreateInvoice(command);
        
        case 'create_bill':
          return await this.handleCreateBill(command);
        
        case 'record_payment':
          return await this.handleRecordPayment(command);
        
        case 'add_customer':
          return await CustomerService.createCustomer(command.parameters);
        
        case 'add_vendor':
          return await VendorService.createVendor(command.parameters);
        
        case 'add_product':
          return await ProductService.createProduct(command.parameters);
        
        case 'create_budget':
          return await BudgetService.createBudget(command.parameters);
        
        case 'record_expense':
          return await TransactionService.createTransaction(command.parameters);
        
        case 'view_pl':
          return await ReportService.generateProfitLoss(
            command.userId,
            command.parameters.startDate,
            command.parameters.endDate
          );
        
        case 'view_balance_sheet':
          return await ReportService.generateBalanceSheet(
            command.userId,
            command.parameters.asOfDate || new Date().toISOString().split('T')[0]
          );
        
        case 'view_invoices':
          return await InvoiceService.getInvoices(command.userId, command.parameters);
        
        case 'view_bills':
          return await BillService.getBills(command.userId, command.parameters);
        
        case 'check_budgets':
          return await BudgetService.checkBudgetStatus(command.userId);
        
        case 'aging_report':
          return await InvoiceService.getAgingReport(command.userId);
        
        default:
          return {
            success: false,
            error: `Unknown command: ${command.action}`
          };
      }
    } catch (error: any) {
      console.error('Error executing AI command:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle invoice creation from AI
   */
  private static async handleCreateInvoice(command: AICommand): Promise<ServiceResponse> {
    // This would be called from the AI with structured parameters
    // The AI would extract: customer, amount, description, line items
    return await InvoiceService.createInvoice(command.parameters, {
      postJournalEntry: true // Auto-post journal entry
    });
  }

  /**
   * Handle bill creation from AI
   */
  private static async handleCreateBill(command: AICommand): Promise<ServiceResponse> {
    return await BillService.createBill(command.parameters, {
      postJournalEntry: true
    });
  }

  /**
   * Handle payment recording from AI
   */
  private static async handleRecordPayment(command: AICommand): Promise<ServiceResponse> {
    const { invoiceId, billId, amount, ...rest } = command.parameters;
    
    if (invoiceId) {
      return await InvoiceService.recordPayment(
        invoiceId,
        amount,
        rest.paymentDate || new Date().toISOString().split('T')[0],
        rest.paymentMethod || 'bank_transfer',
        rest.bankAccountId,
        rest.notes
      );
    }
    
    if (billId) {
      return await BillService.recordPayment(
        billId,
        amount,
        rest.paymentDate || new Date().toISOString().split('T')[0],
        rest.paymentMethod || 'bank_transfer',
        rest.bankAccountId,
        rest.notes
      );
    }
    
    return {
      success: false,
      error: 'Must specify either invoiceId or billId'
    };
  }

  /**
   * Get financial health score
   */
  static async getFinancialHealth(userId: string): Promise<ServiceResponse<{
    score: number;
    insights: string[];
    warnings: string[];
  }>> {
    try {
      const insights: string[] = [];
      const warnings: string[] = [];
      let score = 100;

      // Get financial summary
      const summary = await ReportService.getFinancialSummary(userId);
      if (!summary.success || !summary.data) {
        return { success: false, error: 'Could not fetch financial data' };
      }

      const { totalRevenue, totalExpenses, netIncome } = summary.data;

      // Check profitability
      if (netIncome < 0) {
        score -= 30;
        warnings.push(`Negative net income: $${Math.abs(netIncome).toFixed(2)}`);
      } else if (netIncome > 0) {
        const profitMargin = (netIncome / totalRevenue) * 100;
        if (profitMargin > 20) {
          insights.push(`Excellent profit margin: ${profitMargin.toFixed(1)}%`);
        } else if (profitMargin < 5) {
          score -= 10;
          warnings.push(`Low profit margin: ${profitMargin.toFixed(1)}%`);
        }
      }

      // Check budget status
      const budgets = await BudgetService.checkBudgetStatus(userId);
      if (budgets.success && budgets.data) {
        if (budgets.data.overBudget.length > 0) {
          score -= budgets.data.overBudget.length * 5;
          warnings.push(`${budgets.data.overBudget.length} budgets over limit`);
        }
        if (budgets.data.nearLimit.length > 0) {
          insights.push(`${budgets.data.nearLimit.length} budgets near limit - monitor closely`);
        }
      }

      // Check receivables
      const aging = await InvoiceService.getAgingReport(userId);
      if (aging.success && aging.data) {
        const overdue = aging.data.summary.over_90 + aging.data.summary.days_61_90;
        if (overdue > 0) {
          score -= 15;
          warnings.push(`$${overdue.toFixed(2)} in overdue receivables`);
        }
      }

      // Check bills due
      const billsDue = await BillService.getBillsDueSoon(userId, 7);
      if (billsDue.success && billsDue.data && billsDue.data.length > 0) {
        const totalDue = billsDue.data.reduce((sum: number, bill: any) => sum + bill.balance_due, 0);
        insights.push(`$${totalDue.toFixed(2)} in bills due within 7 days`);
      }

      // Add positive insights
      if (score > 90) {
        insights.push('Your financial health is excellent!');
      } else if (score > 70) {
        insights.push('Your financial health is good with some areas to improve');
      } else if (score > 50) {
        insights.push('Your financial health needs attention');
      } else {
        warnings.push('Your financial health requires immediate attention');
      }

      return {
        success: true,
        data: {
          score: Math.max(0, score),
          insights,
          warnings
        }
      };
    } catch (error: any) {
      console.error('Error calculating financial health:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get AI suggestions based on current financial state
   */
  static async getSuggestions(userId: string): Promise<ServiceResponse<string[]>> {
    try {
      const suggestions: string[] = [];

      // Check for overdue invoices
      const aging = await InvoiceService.getAgingReport(userId);
      if (aging.success && aging.data) {
        if (aging.data.summary.days_61_90 > 0) {
          suggestions.push(
            `💰 You have $${aging.data.summary.days_61_90.toFixed(2)} in invoices overdue 61-90 days. Consider following up with customers.`
          );
        }
      }

      // Check for bills due soon
      const billsDue = await BillService.getBillsDueSoon(userId, 7);
      if (billsDue.success && billsDue.data && billsDue.data.length > 0) {
        suggestions.push(
          `📅 You have ${billsDue.data.length} bills due in the next 7 days. Total: $${billsDue.data.reduce((sum: number, b: any) => sum + b.balance_due, 0).toFixed(2)}`
        );
      }

      // Check for over-budget items
      const budgets = await BudgetService.checkBudgetStatus(userId);
      if (budgets.success && budgets.data) {
        budgets.data.warnings.forEach(warning => {
          suggestions.push(`⚠️ ${warning}`);
        });
      }

      // Check low inventory
      const lowStock = await ProductService.getLowStockProducts(userId);
      if (lowStock.success && lowStock.data && lowStock.data.length > 0) {
        suggestions.push(
          `📦 ${lowStock.data.length} products are low on stock. Consider reordering.`
        );
      }

      if (suggestions.length === 0) {
        suggestions.push('✅ Everything looks good! Your finances are well managed.');
      }

      return { success: true, data: suggestions };
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      return { success: false, error: error.message };
    }
  }
}

