# MUHASIB AI Assistant - Command Reference

Quick reference guide for using the AI accounting assistant.

## 📋 Basic Commands

### Getting Help
```
What can you help me with?
Show me your capabilities
What features do you support?
```

### General Information
```
Show me my financial summary
What's my cash position?
Give me a financial health report
```

---

## 👥 Customer & Vendor Management

### Customers
```
Show me my customers
List all customers
Add a customer named [Name] with email [email@example.com]
Create a new customer [Name] from [Company]
```

### Vendors
```
Show me my vendors
List all vendors
Add a vendor named [Name] with email [email@example.com]
Create a supplier [Name] from [Company]
```

---

## 📊 Invoice Management

### Creating Invoices
```
Create an invoice for [Customer] for $[amount]
Generate an invoice for [Customer] for [description] - $[amount]
Bill [Customer] $[amount] for [service/product]
```

### Managing Invoices
```
Show me my invoices
List invoices from last month
Show overdue invoices
Mark invoice [number] as sent
```

### Recording Payments
```
Record a payment of $[amount] from [Customer]
[Customer] paid $[amount] on invoice [number]
Mark invoice [number] as paid
```

---

## 📄 Bill Management

### Creating Bills
```
Create a bill from [Vendor] for $[amount]
Enter a bill for [Vendor] - $[amount] for [description]
Record a vendor bill for $[amount]
```

### Managing Bills
```
Show me my bills
What bills are due this week?
Show bills due in next 7 days
List overdue bills
Approve bill [number]
```

### Paying Bills
```
Record payment of $[amount] to [Vendor]
Pay bill [number] - $[amount]
Mark bill [number] as paid
```

---

## 📦 Product & Inventory Management

### Products
```
Show me my products
List all products and services
Add a product called "[Name]" for $[price]
Create a service "[Name]" priced at $[price]
```

### Inventory
```
Update inventory for [Product] to [quantity] units
Add [quantity] units to [Product]
Subtract [quantity] from [Product] stock
Show low stock items
What products need reordering?
```

---

## 💰 Transaction & Expense Management

### Recording Transactions
```
Record a $[amount] expense for [category]
Add income of $[amount] from [source]
Record payment of $[amount] for [description]
I spent $[amount] on [category]
```

### Categories
```
Show me my categories
Create a category called "[Name]"
Add a new category for [Purpose]
```

### Budgets
```
Create a monthly budget of $[amount] for [category]
Set a budget for [category] - $[amount] per month
Show my budget status
Check budget alerts
Am I over budget?
```

---

## 📈 Financial Reports

### Profit & Loss
```
Show me my profit and loss
P&L for last month
Show income statement for [date range]
What's my net income?
```

### Balance Sheet
```
Show me my balance sheet
What are my assets and liabilities?
Balance sheet as of today
```

### Cash Flow
```
Show me my cash flow
Cash flow for last quarter
What's my cash position?
```

### Aging Reports
```
Show aging receivables
What invoices are overdue?
Show accounts receivable aging
Show accounts payable aging
Which customers owe me money?
```

### Budget Reports
```
Show budget vs actual
Check my budget status
Which budgets am I over?
Budget performance report
```

---

## 🔧 Chart of Accounts

### Managing Accounts
```
Show me my chart of accounts
List all accounts
Create an account called "[Name]" - [type]
Add a new [asset/liability/revenue/expense] account
```

Account Types:
- **asset** - Cash, Bank, Accounts Receivable
- **liability** - Accounts Payable, Loans, Credit Cards
- **equity** - Owner Equity, Retained Earnings
- **revenue** - Sales, Service Revenue, Income
- **expense** - Operating Expenses, Cost of Goods Sold

---

## 💡 Tips for Better Results

### Be Specific
✅ Good: "Create an invoice for ABC Corp for $1,500 for consulting services due in 30 days"
❌ Vague: "Make an invoice"

### Use Names
✅ Good: "Record payment of $500 from John Smith"
❌ Unclear: "Record a payment"

### Include Dates
✅ Good: "Show me profit and loss for January 2024"
❌ Vague: "Show profit and loss"

### Natural Language Works!
```
✅ "I got paid $500 from ABC Corp today"
✅ "Need to bill XYZ Company for last month's work - $2,000"
✅ "We're running low on Product A, need to reorder"
✅ "How much did I spend on marketing last month?"
```

---

## 🔄 Common Workflows

### New Customer Invoice Flow
```
1. "Add a customer named John Smith from ABC Corp with email john@abc.com"
2. "Create an invoice for ABC Corp for $1,500 for consulting services"
3. "Mark invoice INV-001 as sent"
4. (Later) "Record payment of $1,500 from ABC Corp"
```

### Expense Recording Flow
```
1. "I spent $150 on office supplies at Office Depot"
2. "Record $50 for lunch meeting with client"
3. "Add a $200 expense for software subscription"
```

### Vendor Bill Flow
```
1. "Add a vendor named Tech Supplies Inc with email billing@techsupplies.com"
2. "Create a bill from Tech Supplies for $500 for computer equipment"
3. "Show bills due this week"
4. "Record payment of $500 to Tech Supplies"
```

### Inventory Management Flow
```
1. "Add a product called Laptop priced at $1,200 with cost $800"
2. "Enable inventory tracking with 10 units"
3. "Update inventory for Laptop to 5 units" (after sale)
4. "Show low stock items" (when running low)
```

---

## 🚨 Troubleshooting

### AI Not Understanding?
- Try rephrasing your command
- Be more specific with names and amounts
- Use full names instead of abbreviations
- Include all required details

### Action Not Working?
- Make sure entities exist (customers, vendors, products)
- Check if you have permission
- Verify amounts and dates are correct
- Try breaking complex requests into steps

### Getting Errors?
- Check if required information is provided
- Verify customer/vendor exists before creating invoices/bills
- Ensure product exists before updating inventory
- Check date formats (use "last month", "today", etc.)

---

## 📞 Need Help?

If commands aren't working:
1. Check `AI_ASSISTANT_FIX_GUIDE.md` for troubleshooting
2. Verify OpenRouter API key is set in Supabase
3. Check edge function logs in Supabase Dashboard
4. Try simpler commands first to test connectivity

---

## 🎯 Quick Start Examples

Try these to get started:

```
1. "Hello! What can you do?"
2. "Show me my financial summary"
3. "Add a customer named Test Customer"
4. "Create a product called Test Service for $100"
5. "Show me my customers"
6. "What's my profit and loss?"
```

---

**Remember**: The AI is conversational! Feel free to ask follow-up questions, request clarifications, or have natural conversations about your finances. It's designed to be your virtual accountant! 🤖✨

